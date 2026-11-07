import rawProfiles from '../profiles.json';
import type { DvdProfile, Profile, StandardProfile } from './types';

export * from './types';

export const profiles = rawProfiles as Profile[];

export function getProfile(id: string): Profile | undefined {
  return profiles.find((profile) => profile.id === id);
}

export function validateProfiles(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const profile of profiles) {
    if (ids.has(profile.id)) {
      errors.push(`duplicate id: ${profile.id}`);
    }
    ids.add(profile.id);

    if (!profile.extension.startsWith('.')) {
      errors.push(`${profile.id}: extension must start with a dot`);
    }

    if (profile.type === 'standard') {
      const standard = profile as StandardProfile;
      if (standard.kind === 'video' && !standard.video) {
        errors.push(`${standard.id}: video profile requires a video target`);
      }
      if (standard.kind === 'audio') {
        if (standard.video) {
          errors.push(`${standard.id}: audio profile must not have a video target`);
        }
        if (!standard.audio) {
          errors.push(`${standard.id}: audio profile requires an audio target`);
        }
      }
      if (standard.video && !standard.video.encoder) {
        errors.push(`${standard.id}: empty video encoder`);
      }
      if (standard.audio && !standard.audio.encoder) {
        errors.push(`${standard.id}: empty audio encoder`);
      }
    } else {
      const dvd = profile as DvdProfile;
      if ('video' in dvd || 'audio' in dvd) {
        errors.push(`${dvd.id}: dvd profile must not define targets`);
      }
    }
  }

  return errors;
}
