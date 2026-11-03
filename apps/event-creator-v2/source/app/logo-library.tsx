export const LOGO_LIBRARY_VERSION = "uskudar-512-20261103";
// Replace legacy logo memory once, preserving event content and other settings.
export function migrateLogoLibrary(project) {
  if (project.settings?.logoLibraryVersion === LOGO_LIBRARY_VERSION) return project;
  return {...project, logos: {}, events: project.events.map(({logoOverride, ...event}) => event),
    settings: {...project.settings, logoLibraryVersion: LOGO_LIBRARY_VERSION}};
}
