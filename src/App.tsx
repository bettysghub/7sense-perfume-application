/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorBoundary } from './components/ErrorBoundary';
import { ModuleShell } from './components/ModuleLayout';
import { AppProvider, useApp } from './context/AppContext';
import { AdminModule } from './modules/AdminModule';
import { AiBusinessIntelligence } from './modules/AiBusinessIntelligence';
import { AiMarketingStudio } from './modules/AiMarketingStudio';
import { AiSalesAssistant } from './modules/AiSalesAssistant';
import { CampaignsModule } from './modules/CampaignsModule';
import { CrmModule } from './modules/CrmModule';
import { ExecutiveDashboard } from './modules/ExecutiveDashboard';
import { FinanceModule } from './modules/FinanceModule';
import { MessagingModule } from './modules/MessagingModule';
import { ProductsInventory } from './modules/ProductsInventory';
import { RegionalExpansion } from './modules/RegionalExpansion';
import { StorefrontOrders } from './modules/StorefrontOrders';

function ModuleRouter() {
  const { activeModule, authReady } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] dark:bg-[#0A0A0C]">
        <div className="text-center space-y-2">
          <div className="font-display text-3xl font-semibold tracking-wide text-[#C5A059]">
            7SENSE PERFUMES
          </div>
          <div className="text-xs tracking-widest uppercase text-neutral-500">
            Initializing Intelligence Workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModuleShell>
      {activeModule === 'dashboard' && <ExecutiveDashboard />}
      {activeModule === 'storefront' && <StorefrontOrders key="storefront" initialTab="storefront" />}
      {activeModule === 'orders' && <StorefrontOrders key="orders" initialTab="orders" />}
      {activeModule === 'products' && <ProductsInventory />}
      {activeModule === 'crm' && <CrmModule />}
      {activeModule === 'ai-marketing' && <AiMarketingStudio />}
      {activeModule === 'ai-sales' && <AiSalesAssistant />}
      {activeModule === 'campaigns' && <CampaignsModule />}
      {activeModule === 'messaging' && <MessagingModule />}
      {activeModule === 'finance' && <FinanceModule />}
      {activeModule === 'ai-bi' && <AiBusinessIntelligence />}
      {activeModule === 'regional' && <RegionalExpansion />}
      {activeModule === 'admin' && <AdminModule />}
    </ModuleShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ModuleRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}
