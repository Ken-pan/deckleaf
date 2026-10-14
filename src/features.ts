import type {Component} from 'svelte';
import type {Feature} from './feature-loaders';
export type {Feature,FeatureProps} from './feature-loaders';

// The optional-workspace registry includes generated preload metadata. Load it
// with the first requested workspace rather than every application entry.
const pending = new Map<Feature, Promise<Component<any>>>();
export function loadFeature(feature: Feature): Promise<Component<any>> {
  let request = pending.get(feature);
  if (!request) {
    request = import('./feature-loaders').then(async({loaders})=>(await loaders[feature]()).default as Component<any>).catch(error => {
      pending.delete(feature); // Release our cache; browsers can require a refresh after a failed module request.
      throw error;
    });
    pending.set(feature, request);
  }
  return request;
}
