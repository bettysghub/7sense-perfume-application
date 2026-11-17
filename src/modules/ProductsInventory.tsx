import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ResilientImage } from '../components/ModuleLayout';
import { PRODUCT_IMAGES } from '../data/seedData';
import { convertUsdToLocal, formatCurrency } from '../utils/currency';
import {
  createDocWithTimestamps,
  logAuditEvent,
  makeId,
  removeDocById,
  updateDocWithTimestamp,
} from '../services/firestoreService';
import type { Product } from '../types';

export function ProductsInventory() {
  const {
    user,
    role,
    isAdmin,
    products,
    stockMovements,
    regionalConfigs,
    displayCurrency,
  } = useApp();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [movementModal, setMovementModal] = useState<{
    product: Product;
    type: 'restock' | 'transfer' | 'adjustment';
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    batchNumber: string;
    notes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const canModify = Boolean(user && (isAdmin || ['manager', 'warehouse'].includes(role)));

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.supplier || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, categoryFilter, search]);

  const openCreate = () => {
    setEditing({
      sku: '',
      name: '',
      subtitle: '',
      category: 'Perfume',
      gender: 'Unisex',
      sizeMl: 100,
      variants: ['50ml Eau de Parfum', '100ml Eau de Parfum'],
      fragranceNotes: { top: '', heart: '', base: '' },
      description: '',
      costUsd: 30,
      priceUsd: 150,
      imageUrl: PRODUCT_IMAGES.eternalCitrus,
      stockByWarehouse: { uae_dubai: 50, ng_lagos: 20, ke_nairobi: 10, gh_accra: 10 },
      totalStock: 90,
      reorderPoint: 30,
      supplier: 'Maison Grasse Botanicals',
      batchNumber: `7S-${new Date().getFullYear().toString().slice(-2)}-NEW`,
      active: true,
      isDemo: false,
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editing || !editing.name || !editing.sku) return;
    setSaving(true);
    try {
      const wh = editing.stockByWarehouse || { uae_dubai: 0, ng_lagos: 0, ke_nairobi: 0, gh_accra: 0 };
      const totalStock = Object.values(wh).reduce((s, v) => s + Number(v || 0), 0);
      const priceUsd = Number(editing.priceUsd || 0);
      const regionalPrices = {
        USD: priceUsd,
        AED: Math.round(priceUsd * 3.67),
        NGN: Math.round(priceUsd * 1620),
        GHS: Math.round(priceUsd * 15.8),
        KES: Math.round(priceUsd * 129),
        TZS: Math.round(priceUsd * 2680),
        UGX: Math.round(priceUsd * 3720),
      };

      const payload = {
        sku: editing.sku.trim().replace(/[^a-zA-Z0-9_-]/g, '-'),
        name: editing.name.trim(),
        subtitle: editing.subtitle || '',
        category: editing.category || 'Perfume',
        gender: editing.gender || 'Unisex',
        sizeMl: Number(editing.sizeMl || 100),
        variants: (editing.variants || ['100ml']).slice(0, 10),
        fragranceNotes: editing.fragranceNotes || { top: '', heart: '', base: '' },
        description: editing.description || '',
        costUsd: Number(editing.costUsd || 0),
        priceUsd,
        regionalPrices,
        imageUrl: editing.imageUrl || PRODUCT_IMAGES.eternalCitrus,
        stockByWarehouse: wh,
        totalStock,
        reorderPoint: Number(editing.reorderPoint || 20),
        supplier: editing.supplier || '',
        batchNumber: editing.batchNumber || '',
        active: editing.active !== false,
        isDemo: false,
        ownerUid: editing.ownerUid || user.uid,
      };

      if (editing.id) {
        await updateDocWithTimestamp('products', editing.id, payload);
        await logAuditEvent({
          actorRole: role,
          action: 'UPDATE_PRODUCT',
          module: 'Products & Inventory',
          targetId: editing.id,
          details: `Updated product ${payload.name} (${payload.sku})`,
        });
      } else {
        const id = makeId('prod');
        await createDocWithTimestamps('products', id, payload);
        await logAuditEvent({
          actorRole: role,
          action: 'CREATE_PRODUCT',
          module: 'Products & Inventory',
          targetId: id,
          details: `Created product ${payload.name} (${payload.sku})`,
        });
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !movementModal || movementModal.quantity <= 0) return;
    setSaving(true);
    try {
      const { product, type, fromWarehouse, toWarehouse, quantity, batchNumber, notes } = movementModal;
      const wh = { ...(product.stockByWarehouse || { uae_dubai: 0, ng_lagos: 0, ke_nairobi: 0, gh_accra: 0 }) };

      if (type === 'restock') {
        wh[toWarehouse] = (wh[toWarehouse] || 0) + quantity;
      } else if (type === 'transfer') {
        wh[fromWarehouse] = Math.max(0, (wh[fromWarehouse] || 0) - quantity);
        wh[toWarehouse] = (wh[toWarehouse] || 0) + quantity;
      } else if (type === 'adjustment') {
        wh[toWarehouse] = Math.max(0, (wh[toWarehouse] || 0) - quantity);
      }

      const totalStock = Object.values(wh).reduce((s, v) => s + Number(v || 0), 0);

      await updateDocWithTimestamp('products', product.id, {
        stockByWarehouse: wh,
        totalStock,
        batchNumber: batchNumber || product.batchNumber || '',
      });

      const movId = makeId('mov');
      await createDocWithTimestamps(
        'stockMovements',
        movId,
        {
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          type,
          fromWarehouse,
          toWarehouse,
          quantity,
          batchNumber,
          notes,
          ownerUid: user.uid,
          isDemo: false,
        },
        false
      );

      await logAuditEvent({
        actorRole: role,
        action: `STOCK_${type.toUpperCase()}`,
        module: 'Products & Inventory',
        targetId: product.id,
        details: `${type} ${quantity} units of ${product.sku} (${fromWarehouse} -> ${toWarehouse})`,
      });

      setMovementModal(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Multi-Warehouse Catalog &amp; Supply Chain
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            Products &amp; Inventory
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search SKU, name, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800 w-60"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
          >
            {['All', 'Perfume', 'Gift Set', 'Candle', 'Diffuser', 'Car Fragrance'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {canModify && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Product Inventory Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left bg-neutral-50 dark:bg-[#16161B]">
                <th className="py-3 px-4 font-medium">Product</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium text-right">Cost / Price</th>
                <th className="py-3 px-4 font-medium text-right">Dubai</th>
                <th className="py-3 px-4 font-medium text-right">Lagos</th>
                <th className="py-3 px-4 font-medium text-right">Nairobi</th>
                <th className="py-3 px-4 font-medium text-right">Accra</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
                {canModify && <th className="py-3 px-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const wh = p.stockByWarehouse || {};
                const low = p.totalStock <= p.reorderPoint;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <ResilientImage
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-11 h-11 rounded-lg object-cover shrink-0 border border-neutral-200 dark:border-neutral-800"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {p.name}
                            {p.isDemo && (
                              <span className="ml-2 text-[11px] font-mono text-[#A8833E] dark:text-[#C5A059]">
                                · DEMO
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono">
                            {p.sku} · Batch {p.batchNumber || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-600 dark:text-neutral-300">
                      {p.category} · {p.gender} · {p.sizeMl}ml
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="font-medium">
                        {formatCurrency(
                          p.regionalPrices?.[displayCurrency] ??
                            convertUsdToLocal(p.priceUsd, displayCurrency, regionalConfigs),
                          displayCurrency
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">Cost ${p.costUsd}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{wh.uae_dubai ?? 0}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{wh.ng_lagos ?? 0}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{wh.ke_nairobi ?? 0}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{wh.gh_accra ?? 0}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={low ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'font-semibold'}>
                        {p.totalStock}
                      </span>
                      <div className="text-[11px] text-neutral-500">Min {p.reorderPoint}</div>
                    </td>
                    {canModify && (
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setMovementModal({
                                product: p,
                                type: 'transfer',
                                fromWarehouse: 'uae_dubai',
                                toWarehouse: 'ng_lagos',
                                quantity: 10,
                                batchNumber: p.batchNumber || '',
                                notes: '',
                              })
                            }
                            className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-[#C5A059]"
                            title="Restock / Transfer Stock"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditing(p)}
                            className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-[#C5A059]"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => removeDocById('products', p.id)}
                              className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-red-500 text-red-500"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Stock Movements */}
      {stockMovements.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Warehouse Stock Movements</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left">
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 font-medium">Route</th>
                  <th className="py-2 font-medium text-right">Qty</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.slice(0, 12).map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0"
                  >
                    <td className="py-2.5 capitalize font-medium">{m.type}</td>
                    <td className="py-2.5">
                      {m.productName} <span className="text-xs font-mono text-neutral-500">({m.sku})</span>
                    </td>
                    <td className="py-2.5 text-xs text-neutral-500">
                      {m.fromWarehouse || '—'} → {m.toWarehouse || '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{m.quantity}</td>
                    <td className="py-2.5 text-xs text-neutral-500">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Product Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-display text-2xl font-semibold">
                {editing.id ? `Edit ${editing.name}` : 'New Fragrance Product'}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Product Name *</label>
                <input
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">SKU *</label>
                <input
                  required
                  value={editing.sku || ''}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Category</label>
                <select
                  value={editing.category || 'Perfume'}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value as Product['category'] })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  {['Perfume', 'Diffuser', 'Candle', 'Car Fragrance', 'Gift Set'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Audience</label>
                <select
                  value={editing.gender || 'Unisex'}
                  onChange={(e) =>
                    setEditing({ ...editing, gender: e.target.value as Product['gender'] })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  {['Women', 'Unisex', 'Men', 'Home'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Unit Cost (USD)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.costUsd ?? 0}
                  onChange={(e) => setEditing({ ...editing, costUsd: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Selling Price (USD)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.priceUsd ?? 0}
                  onChange={(e) => setEditing({ ...editing, priceUsd: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Size (ml / g)</label>
                <input
                  type="number"
                  min={1}
                  value={editing.sizeMl ?? 100}
                  onChange={(e) => setEditing({ ...editing, sizeMl: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Reorder Point</label>
                <input
                  type="number"
                  min={0}
                  value={editing.reorderPoint ?? 20}
                  onChange={(e) => setEditing({ ...editing, reorderPoint: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-neutral-500 mb-1">Subtitle / Accord Summary</label>
                <input
                  value={editing.subtitle || ''}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-neutral-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475]"
              >
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Movement Modal */}
      {movementModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleStockMovement}
            className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-display text-xl font-semibold">
                Stock Movement · {movementModal.product.name}
              </h3>
              <button type="button" onClick={() => setMovementModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Operation Type</label>
                <select
                  value={movementModal.type}
                  onChange={(e) =>
                    setMovementModal({
                      ...movementModal,
                      type: e.target.value as 'restock' | 'transfer' | 'adjustment',
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  <option value="restock">Restock Incoming Batch</option>
                  <option value="transfer">Inter-Warehouse Transfer</option>
                  <option value="adjustment">Write-off / Adjustment</option>
                </select>
              </div>
              {movementModal.type === 'transfer' && (
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">From Warehouse</label>
                  <select
                    value={movementModal.fromWarehouse}
                    onChange={(e) =>
                      setMovementModal({ ...movementModal, fromWarehouse: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                  >
                    <option value="uae_dubai">UAE Dubai Hub</option>
                    <option value="ng_lagos">Nigeria Lagos Vault</option>
                    <option value="ke_nairobi">Kenya Nairobi Hub</option>
                    <option value="gh_accra">Ghana Accra Boutique</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  {movementModal.type === 'adjustment' ? 'Target Warehouse' : 'Destination Warehouse'}
                </label>
                <select
                  value={movementModal.toWarehouse}
                  onChange={(e) =>
                    setMovementModal({ ...movementModal, toWarehouse: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  <option value="uae_dubai">UAE Dubai Hub</option>
                  <option value="ng_lagos">Nigeria Lagos Vault</option>
                  <option value="ke_nairobi">Kenya Nairobi Hub</option>
                  <option value="gh_accra">Ghana Accra Boutique</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={movementModal.quantity}
                  onChange={(e) =>
                    setMovementModal({ ...movementModal, quantity: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Batch Number / Notes</label>
                <input
                  value={movementModal.notes}
                  onChange={(e) => setMovementModal({ ...movementModal, notes: e.target.value })}
                  placeholder="e.g. Air freight manifest #224"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setMovementModal(null)}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold"
              >
                {saving ? 'Updating...' : 'Confirm Movement'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
