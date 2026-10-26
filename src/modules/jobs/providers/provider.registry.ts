import { JobProvider } from './provider.types';
import { ArbeitnowAdapter } from '../adapters/arbeitnow/arbeitnow.adapter';
import { RemotiveAdapter } from '../adapters/remotive/remotive.adapter';
import { JobicyAdapter } from '../adapters/jobicy/jobicy.adapter';
import { RemoteOkAdapter } from '../adapters/remoteok/remoteok.adapter';
import { HimalayasAdapter } from '../adapters/himalayas/himalayas.adapter';
import { WeWorkRemotelyAdapter } from '../adapters/weworkremotely/weworkremotely.adapter';
import { GreenhouseAdapter } from '../adapters/ats/greenhouse.adapter';
import { AshbyAdapter } from '../adapters/ats/ashby.adapter';

export class ProviderRegistry {
  private static defaultProviders: JobProvider[] = [
    new ArbeitnowAdapter(),
    new RemotiveAdapter(),
    new JobicyAdapter(),
    new RemoteOkAdapter(),
    new HimalayasAdapter(),
    new WeWorkRemotelyAdapter(),
    new GreenhouseAdapter(),
    new AshbyAdapter(),
  ];

  static getDefaultProviders(): JobProvider[] {
    return [...this.defaultProviders];
  }
}
