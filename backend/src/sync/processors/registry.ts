import { serviceCasesProcessor } from './service-cases.processor';
import {
  callCenterProcessor, chairClaimsProcessor, chatDailyProcessor, chatOffhourProcessor,
  creditNotesProcessor, faqProcessor, presaleProcessor, reviewGroupProcessor,
  smsProcessor, sparePartsProcessor, usageIssuesProcessor,
} from './simple.processors';
import { SheetProcessor } from './types';

/**
 * processor name (stored in data_sources.processor) → implementation.
 * Sheet classification from docs/ARCHITECTURE.md — derived/template/junk sheets are not synced.
 */
export const PROCESSORS: Record<string, SheetProcessor> = {
  service_cases: serviceCasesProcessor,
  usage_issues: usageIssuesProcessor,
  sms_logs: smsProcessor,
  chat_daily: chatDailyProcessor,
  chat_offhour: chatOffhourProcessor,
  call_center: callCenterProcessor,
  chair_claims: chairClaimsProcessor,
  spare_parts: sparePartsProcessor,
  credit_notes: creditNotesProcessor,
  presale: presaleProcessor,
  faq_general: faqProcessor(null, false),
  faq_fantech: faqProcessor('fantech', true),
  faq_ugreen: faqProcessor('ugreen', true),
  review_groups: reviewGroupProcessor,
};
