import { ipoIngestionCron, gmpModelRefitCron } from './ipo-ingestion';
import { drhpIndexFunction, drhpAnalyzeFunction } from './drhp';
import { allotmentCron } from './allotment-cron';

export const functions = [ipoIngestionCron, gmpModelRefitCron, drhpIndexFunction, drhpAnalyzeFunction, allotmentCron];
