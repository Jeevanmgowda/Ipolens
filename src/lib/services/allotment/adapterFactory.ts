import { RegistrarSlug } from '@/types/allotment';
import { BaseRegistrarAdapter } from './adapters/base.adapter';
import { MufgIntimeAdapter } from './adapters/linkintime.adapter';
import { KFintechAdapter } from './adapters/kfintech.adapter';
import { BigshareAdapter } from './adapters/bigshare.adapter';
import { BseGatewayAdapter } from './adapters/bse.adapter';
import { GenericRegistrarAdapter } from './adapters/generic.adapter';

export class RegistrarAdapterFactory {
  private static mufgIntimeInstance = new MufgIntimeAdapter();
  private static kfintechInstance = new KFintechAdapter();
  private static bigshareInstance = new BigshareAdapter();
  private static bseInstance = new BseGatewayAdapter();

  private static cameoInstance = new GenericRegistrarAdapter({
    slug: 'cameo',
    name: 'Cameo Corporate Services Ltd',
    portalUrl: 'https://ipo.cameoindia.com/',
    mirrors: [
      {
        serverName: 'Server 1 (Cameo India)',
        url: 'https://ipo.cameoindia.com/',
        isPrimary: true,
      },
    ],
  });

  private static maashitlaInstance = new GenericRegistrarAdapter({
    slug: 'maashitla',
    name: 'Maashitla Securities Pvt Ltd',
    portalUrl: 'https://maashitla.com/allotment-status',
    mirrors: [
      {
        serverName: 'Server 1 (Maashitla Portal)',
        url: 'https://maashitla.com/allotment-status',
        isPrimary: true,
      },
    ],
  });

  private static skylineInstance = new GenericRegistrarAdapter({
    slug: 'skyline',
    name: 'Skyline Financial Services Pvt Ltd',
    portalUrl: 'https://www.skylinerta.com/ipo.php',
    mirrors: [
      {
        serverName: 'Server 1 (Skyline RTA)',
        url: 'https://www.skylinerta.com/ipo.php',
        isPrimary: true,
      },
    ],
  });

  public static getAdapter(slug: RegistrarSlug): BaseRegistrarAdapter {
    switch (slug) {
      case 'linkintime':
        return this.mufgIntimeInstance;
      case 'kfintech':
        return this.kfintechInstance;
      case 'bigshare':
        return this.bigshareInstance;
      case 'cameo':
        return this.cameoInstance;
      case 'maashitla':
        return this.maashitlaInstance;
      case 'skyline':
        return this.skylineInstance;
      case 'other':
      default:
        return this.bseInstance;
    }
  }
}
