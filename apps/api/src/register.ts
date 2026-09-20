// Registers every bot with the runtime. Imported for its side effect by the
// API server and by the demo script.
import { registry } from '@botworks/core'

// Tier 1
import inboxTriageBot from '@botworks/inbox-triage'
import documentExtractBot from '@botworks/document-extract'
// Tier 2
import customerSupportBot from '@botworks/customer-support'
import onboardingBot from '@botworks/onboarding'
import followUpBot from '@botworks/follow-up'
import dataSyncBot from '@botworks/data-sync'
import reportGeneratorBot from '@botworks/report-generator'
// Tier 3
import appointmentBot from '@botworks/appointment'
import employeeMgmtBot from '@botworks/employee-mgmt'
import inventoryBot from '@botworks/inventory'
import billingBot from '@botworks/billing'
import taxPrepBot from '@botworks/tax-prep'
import reviewAnalysisBot from '@botworks/review-analysis'

for (const bot of [
  inboxTriageBot, documentExtractBot,
  customerSupportBot, onboardingBot, followUpBot, dataSyncBot, reportGeneratorBot,
  appointmentBot, employeeMgmtBot, inventoryBot, billingBot, taxPrepBot, reviewAnalysisBot,
]) {
  registry.register(bot)
}
