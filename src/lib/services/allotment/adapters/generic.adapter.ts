import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

interface GenericRegistrarConfig {
  slug: RegistrarSlug;
  name: string;
  portalUrl: string;
  mirrors: RegistrarServerMirror[];
}

export class GenericRegistrarAdapter extends BaseRegistrarAdapter {
  readonly slug: RegistrarSlug;
  readonly name: string;
  readonly portalUrl: string;
  readonly mirrors: RegistrarServerMirror[];

  constructor(config: GenericRegistrarConfig) {
    super();
    this.slug = config.slug;
    this.name = config.name;
    this.portalUrl = config.portalUrl;
    this.mirrors = config.mirrors;
  }

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    return this.buildInteractiveRequiredResult(
      `${this.name} requires direct investor verification. Click the official 1-click gateway link below to check your allotment.`
    );
  }
}

