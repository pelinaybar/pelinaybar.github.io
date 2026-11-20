import { clubKey } from './studio-core';

export const LOGO_LIBRARY_VERSION = "uskudar-512-20261120-r2";
const currentClubKeys = new Set(["adlibilimlervecezaadaletikulubu", "ameliyathanehizmetlerikulubu", "anestezikulubu", "animasyonkulubu", "avrupatipogrencileribirligikulubuemsa", "beslenmevediyetetikkulubu", "bilimkurguvefantastikkulturkulubu", "birbakimbirdokunuskulubu", "biyoteknolojivebiyomuhendislikkulubu", "bobrekdostlarikulubu", "chemicalengineeringsocietykulubu", "caginvicdanikulubu", "cocukgelisimikulubu", "cocukhizmetlerikulubu", "danskulubu", "dijitaldonusumkulubu", "dilvekonusmaterapisikulubu", "dishekimligikulturvegelisimkulubu", "disprotezkulubu", "dogasporlarikulubu", "ekovizyonkulubu", "endustriveliderlikkulubu", "ergoterapikulubu", "felsefekulubu", "fikirveaksiyonkulubu", "finansalokuryazarlikkulubu", "fizyoterapiveortezprotezkulubu", "fizyoterapiverehabilitasyonkulubu", "gazetecilikkulubu", "geleceginliderlerikulubu", "gencgonullulerkulubu", "genciletisimcilerkulubu", "genctemakulubu", "genctibbiyelilerkulubu", "gencyeryuzudoktorlarikulubu", "gencyesilaykulubu", "genclikkulubu", "geropsikolojikulubu", "gidakulubu", "googledevelopergroupsoncampuskulubu", "gucistencidostlukvedayanismakulubu", "hayditutelimikulubu", "hayvanlarikorumakulubu", "hemsirelikkulubu", "ieeeogrencikolukulubu", "interculturalkulubu", "ilkveacilyardimkulubu", "kalitekulubu", "kizilaykulubu", "kolektifkulubu", "laboratuvarteknikerligikulubu", "losemilicocuklarafaydakulubu", "modelbirlesmismilletlerkulubu", "molekulerbiyolojivegenetikkulubu", "mucizeyeilkdokunuskulubu", "muzikkulubu", "noropsikolojikulubu", "odyolojikulubu", "okculukkulubu", "ombudsmankulubu", "perfuzyonkulubu", "podolojikulubu", "politikaveanalizkulubu", "pozitifpsikolojikulubu", "psikolojikulubu", "saglikyonetimikulubu", "sagliktaenformasyondijitallesmeveyonetim", "satirarasiokumayazmaveatolyekulubu", "senaryobazliisgkulubu", "sessizligibozkulubu", "sinemakulubu", "sivilsavunmakulubu", "sosyalhizmetkulubu", "sosyolojikulubu", "stratejikarastirmalarvegelistirmekulubu", "surdurulebilirkalkinmakulubu", "tarihkulubu", "tarihvekulturkulubu", "tasarimkulubu", "thepeopleskulubu", "tiyatrokulubu", "turkcekonusmakulubu", "uluslararasidiplomasikulubu", "uskudarbiyomedikalkulubu", "uskudarcevirikulubu", "uskudarelektronorofizyolojikulubu", "uskudartipogrencileribirligikulubu", "uskudaruniversitesicansagligikulubu", "uskudaruniversitesinadirhastaliklarkulubu", "uskudaruniversitesisporkulubu", "uskudaruniversitesiteknofestkulubu", "uskudaruniversitesiteknolojiveinovasyonkulubu", "yapayzekakulubu", "yenimedyakulubu", "yenilerkulubu", "yetenekfarkindaligikulubu", "yonetimbilisimsistemlerikulubu"]);
const customImage = (src) => typeof src === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(src);

// Refresh official logos, retaining custom images for historical/unlisted clubs.
// History recovers those images if an earlier library migration discarded them.
export function migrateLogoLibrary(project, history = []) {
  if (project.settings?.logoLibraryVersion === LOGO_LIBRARY_VERSION) return project;
  const logos = {};
  for (const previous of [...history].reverse().concat(project)) {
    for (const [key, src] of Object.entries(previous.logos || {})) {
      if (!currentClubKeys.has(key) && customImage(src)) logos[key] = src;
    }
  }
  return {...project, logos, events: project.events.map(({logoOverride, ...event}) => {
    if (currentClubKeys.has(clubKey(event.club))) return event;
    const previous = history.flatMap(p => p.events || []).find(e => e.id === event.id && e.club === event.club && customImage(e.logoOverride));
    const custom = customImage(logoOverride) ? logoOverride : previous?.logoOverride;
    return custom ? {...event, logoOverride: custom} : event;
  }), settings: {...project.settings, logoLibraryVersion: LOGO_LIBRARY_VERSION}};
}
