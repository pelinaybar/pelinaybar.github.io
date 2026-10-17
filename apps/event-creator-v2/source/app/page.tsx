"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {validateProject,duplicateKey,campusText,validDate,projectSignature} from "./studio-model";
import StudioTools, { ExcelImport, rowIssues } from "./studio-tools";
import {resolveLogo,logoStatus,prepareImage,packPages,inspectNodes,ZoomView,ClubPicker,ExportReview,clubKey,packHistory,readHistory} from "./studio-core";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  MapPin,
  Mic2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { siFacebook, siInstagram, siYoutube, siX } from "simple-icons";

type Format = "mail" | "post" | "story" | "summary" | "summaryStory";
type EventItem = {
  id: string;
  club: string;
  title: string;
  date: string;
  time: string;
  endDate?: string;
  speaker: string;
  campus: string;
  location: string;
  order?: number;
  logoOverride?: string;
};
declare global { interface Window { __sksDragged?: boolean } }
type DraftSnapshot = {
  logos?:Record<string,string>;background?:string;settings?:any;
  id: string;
  at: string;
  label: string;
  events: EventItem[];
};
const DRAFT_KEY = "sks-event-studio-v2-draft";
const HISTORY_KEY = "sks-event-studio-v2-history";
const PUBLIC_BASE = "/apps/event-creator-v2";
const FORMATS: Record<
  Format,
  { label: string; size: string; w: number; h: number; icon: typeof Mail }
> = {
  mail: {
    label: "Mail Bülteni",
    size: "1200 × otomatik",
    w: 1200,
    h: 1680,
    icon: Mail,
  },
  post: {
    label: "Instagram Post",
    size: "1080 × 1350",
    w: 1080,
    h: 1350,
    icon: ImageIcon,
  },
  story: {
    label: "Instagram Story",
    size: "1080 × 1920",
    w: 1080,
    h: 1920,
    icon: Sparkles,
  },
  summary: {
    label: "Haftalık Özet",
    size: "1080 × 1350",
    w: 1080,
    h: 1350,
    icon: LayoutGrid,
  },
  summaryStory: {
    label: "Özet Story",
    size: "1080 × 1920",
    w: 1080,
    h: 1920,
    icon: LayoutGrid,
  },
};
const CAMPUS: Record<string, { key: string; color: string; soft: string }> = {
  merkez: { key: "Merkez", color: "#37478C", soft: "#E9ECF8" },
  güney: { key: "Güney", color: "#67B33F", soft: "#EDF7E8" },
  guney: { key: "Güney", color: "#67B33F", soft: "#EDF7E8" },
  çarşı: { key: "Çarşı", color: "#B5A52B", soft: "#F7F4DD" },
  carsi: { key: "Çarşı", color: "#B5A52B", soft: "#F7F4DD" },
  np: { key: "NP", color: "#24AAA7", soft: "#E5F7F6" },
  sağlık: { key: "NP", color: "#24AAA7", soft: "#E5F7F6" },
};
const SUMMARY_COLORS = [
  { color: "#24AAA7", soft: "#E5F7F6" },
  { color: "#67B33F", soft: "#EDF7E8" },
  { color: "#37478C", soft: "#E9ECF8" },
  { color: "#B5A52B", soft: "#F7F4DD" },
  { color: "#B41655", soft: "#F9E8EF" },
  { color: "#E2763E", soft: "#FCEDE5" },
  { color: "#7557B8", soft: "#F0ECFA" },
];
const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "Yılbaşı",
  "04-23": "Ulusal Egemenlik ve Çocuk Bayramı",
  "05-01": "Emek ve Dayanışma Günü",
  "05-19": "Atatürk’ü Anma, Gençlik ve Spor Bayramı",
  "07-15": "Demokrasi ve Millî Birlik Günü",
  "08-30": "Zafer Bayramı",
  "10-28": "Cumhuriyet Bayramı Arifesi · 13.00 sonrası",
  "10-29": "Cumhuriyet Bayramı",
};
const DATED_HOLIDAYS: Record<string, string> = {
  "2026-03-19": "Ramazan Bayramı Arifesi · 13.00 sonrası",
  "2026-03-20": "Ramazan Bayramı · 1. Gün",
  "2026-03-21": "Ramazan Bayramı · 2. Gün",
  "2026-03-22": "Ramazan Bayramı · 3. Gün",
  "2026-05-26": "Kurban Bayramı Arifesi · 13.00 sonrası",
  "2026-05-27": "Kurban Bayramı · 1. Gün",
  "2026-05-28": "Kurban Bayramı · 2. Gün",
  "2026-05-29": "Kurban Bayramı · 3. Gün",
  "2026-05-30": "Kurban Bayramı · 4. Gün",
  "2027-03-08": "Ramazan Bayramı Arifesi · 13.00 sonrası",
  "2027-03-09": "Ramazan Bayramı · 1. Gün",
  "2027-03-10": "Ramazan Bayramı · 2. Gün",
  "2027-03-11": "Ramazan Bayramı · 3. Gün",
  "2027-05-15": "Kurban Bayramı Arifesi · 13.00 sonrası",
  "2027-05-16": "Kurban Bayramı · 1. Gün",
  "2027-05-17": "Kurban Bayramı · 2. Gün",
  "2027-05-18": "Kurban Bayramı · 3. Gün",
  "2027-05-19": "Kurban Bayramı · 4. Gün",
};
const samples: EventItem[] = [
  {
    id: "1",
    club: "Sosyal Hizmet Kulübü",
    title: "Ekranın Arkasındaki Şiddet",
    date: "2026-09-21",
    time: "14.00–17.00",
    speaker: "Dr. Deniz Yalçın",
    campus: "Çarşı Yerleşkesi",
    location: "302 Nolu Derslik",
  },
  {
    id: "2",
    club: "Bilişim Kulübü",
    title: "Microsoft Teknoloji Gezisi",
    date: "2026-09-21",
    time: "13.00–14.00",
    speaker: "",
    campus: "Merkez Yerleşkesi",
    location: "Microsoft İstanbul",
  },
  {
    id: "3",
    club: "Sosyoloji Kulübü",
    title: "Toplumsal Açıdan Okullarda Şiddet",
    date: "2026-09-21",
    time: "12.00–13.00",
    speaker: "",
    campus: "Güney Yerleşkesi",
    location: "E Blok Bahçe",
  },
  {
    id: "4",
    club: "Tarih ve Kültür Kulübü",
    title: "Dijital ve Fiziki Tarih Söyleşileri",
    date: "2026-09-21",
    time: "15.00–16.00",
    speaker: "",
    campus: "Merkez Yerleşkesi",
    location: "Şehit Duha Beker Salonu",
  },
  {
    id: "5",
    club: "Dans Kulübü veya Müzik Kulübü",
    title: "Kampüste Ritim Buluşması",
    date: "2026-09-21",
    time: "18.00–20.00",
    speaker: "",
    campus: "NP Yerleşkesi",
    location: "Açık Etkinlik Alanı",
  },
  {
    id: "6",
    club: "Genç Gönüllüler Kulübü",
    title: "Gönüllülük Tanışma Toplantısı",
    date: "2026-09-21",
    time: "16.30–17.30",
    speaker: "",
    campus: "Çarşı Yerleşkesi",
    location: "Emir Nebi Konferans Salonu",
  },
  {
    id: "7",
    club: "Animasyon Kulübü",
    title: "Animasyon Atölyesi",
    date: "2026-09-22",
    time: "10.00–12.00",
    speaker: "",
    campus: "Merkez Yerleşkesi",
    location: "A Blok 201",
  },
  {
    id: "8",
    club: "Çocuk Gelişimi Kulübü",
    title: "Çocuklarla Yaratıcı Oyun",
    date: "2026-09-22",
    time: "13.00–14.30",
    speaker: "",
    campus: "Güney Yerleşkesi",
    location: "Beylerbeyi Salonu",
  },
  {
    id: "9",
    club: "Fizyoterapi Kulübü",
    title: "Sağlıklı Yaşam Buluşması",
    date: "2026-09-22",
    time: "15.00–16.30",
    speaker: "",
    campus: "NP Yerleşkesi",
    location: "Spor Salonu",
  },
  {
    id: "10",
    club: "Tiyatro Kulübü",
    title: "Sahneye İlk Adım",
    date: "2026-09-22",
    time: "17.00–19.00",
    speaker: "",
    campus: "Çarşı Yerleşkesi",
    location: "Ayhan Songar Salonu",
  },
  {
    id: "11",
    club: "Yapay Zekâ ve Akıllı Sistemler Kulübü",
    title: "Yapay Zekâya Giriş",
    date: "2026-09-23",
    time: "11.00–12.30",
    speaker: "",
    campus: "Merkez Yerleşkesi",
    location: "Nermin Tarhan Salonu",
  },
  {
    id: "12",
    club: "Çeviri Kulübü",
    title: "Diller Arası Kültür",
    date: "2026-09-23",
    time: "13.00–14.00",
    speaker: "",
    campus: "Güney Yerleşkesi",
    location: "E Blok 204",
  },
  {
    id: "13",
    club: "Kızılay Kulübü",
    title: "Afet Farkındalık Eğitimi",
    date: "2026-09-23",
    time: "14.30–16.00",
    speaker: "",
    campus: "Çarşı Yerleşkesi",
    location: "Kuleli Salonu",
  },
  {
    id: "14",
    club: "Sinema Kulübü",
    title: "Kısa Film Gösterimi",
    date: "2026-09-23",
    time: "18.00–20.00",
    speaker: "",
    campus: "Merkez Yerleşkesi",
    location: "Cep Sineması",
  },
  {
    id: "15",
    club: "Beslenme ve Diyetetik Kulübü",
    title: "Kampüste Sağlıklı Beslenme",
    date: "2026-09-24",
    time: "10.30–12.00",
    speaker: "",
    campus: "NP Yerleşkesi",
    location: "NP Sağlık Yerleşkesi",
  },
  {
    id: "16",
    club: "Hemşirelik Kulübü",
    title: "Sağlıkta İletişim",
    date: "2026-09-24",
    time: "13.00–14.30",
    speaker: "",
    campus: "NP Yerleşkesi",
    location: "Konferans Salonu",
  },
  {
    id: "17",
    club: "Genç Yeşilay Kulübü",
    title: "Bağımsız Yaşam Atölyesi",
    date: "2026-09-24",
    time: "15.00–16.00",
    speaker: "",
    campus: "Çarşı Yerleşkesi",
    location: "D Blok 101",
  },
  {
    id: "18",
    club: "Moleküler Biyoloji ve Genetik Kulübü",
    title: "Bilimsel Araştırma Buluşması",
    date: "2026-09-25",
    time: "11.00–12.30",
    speaker: "",
    campus: "Merkez Yerleşkesi",
    location: "Nermin Tarhan Salonu",
  },
  {
    id: "19",
    club: "Sürdürülebilir Kalkınma Kulübü",
    title: "Sürdürülebilir Kampüs",
    date: "2026-09-25",
    time: "14.00–15.30",
    speaker: "",
    campus: "Güney Yerleşkesi",
    location: "E Blok Bahçe",
  },
  {
    id: "20",
    club: "Tasarım Kulübü",
    title: "Afiş Tasarım Atölyesi",
    date: "2026-09-25",
    time: "16.00–18.00",
    speaker: "",
    campus: "Çarşı Yerleşkesi",
    location: "İletişim Atölyesi",
  },
];
const normalize = (v: string) =>
  v
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (v: unknown) => {
  if (!v) return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? String(v)
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const displayDate = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
const dayName = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(
    new Date(`${iso}T12:00:00`),
  );
const shortDayName = (iso: string) =>
  ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"][
    new Date(`${iso}T12:00:00`).getDay()
  ];
const weekBounds = (iso: string) => {
  const start = new Date(`${iso}T12:00:00`),
    day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const asIso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: asIso(start), end: asIso(end) };
};
const displayWeekRange = (iso: string) => {
  const week = weekBounds(iso),
    first = displayDate(week.start).split(" ");
  return `${first.slice(0, -1).join(" ")} - ${displayDate(week.end)}`;
};
const getHoliday = (iso: string) => {
  const labels = [DATED_HOLIDAYS[iso], FIXED_HOLIDAYS[iso.slice(5)]].filter(
    Boolean,
  );
  return labels.join(" · ");
};
const getCampus = (name: string) =>
  ["online","cevrimici","zoom","microsoftteams","teams"].includes(normalize(name))?{key:"Çevrimiçi",color:"#107F88",soft:"#E4F4F6"}:Object.entries(CAMPUS).find(([k]) =>
    normalize(name).includes(normalize(k)),
  )?.[1] ?? { key: name.trim() || "Yerleşke belirtilmedi", color: "#B41655", soft: "#F9E8EF" };
const campusLabel = (name:string) => campusText(name)||"Yerleşke belirtilmedi";
// “ve” kulüp adının doğal bir parçası olabilir. Ortak kulüp yalnızca “veya”
// ya da açık ayraçlarla (&, +, virgül, noktalı virgül, /) belirtilir.
const splitClubs = (club: string) =>
  club
    .split(/\s+(?:veya|&|\+)\s+|\s*[,;/]\s*/i)
    .filter(Boolean)
    ;
const startTime = (time: string) => {
  const m = time.match(/(\d{1,2})[.:](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
};

function ClubLogo({
  name,
  logos,
  small = false,
  override,
}: {
  name: string;
  logos: Record<string, string>;
  small?: boolean;
  override?: string;
}) {
  if (override)
    return (
      <img
        className={`club-logo ${small ? "small" : ""}`}
        src={override}
        alt={name+" logosu"}
      />
    );
  const match = resolveLogo(name, logos);
  if (match.src) return <img className={`club-logo ${small ? "small" : ""}`} src={match.src} alt={name + " logosu"} data-logo-status={match.status} data-club={name}/>;
  const initials =
    name
      .replace(/Üsküdar Üniversitesi/gi, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toLocaleUpperCase("tr-TR") || "SK";
  return (
    <span className={`club-logo fallback ${small ? "small" : ""}`} data-logo-status={match.status} data-club={name} title={logoStatus(match)}>
      {initials}
    </span>
  );
}

export default function Home() {
  const [format, setFormat] = useState<Format>("post"),
    [events, rawSetEvents] = useState<EventItem[]>(samples),
    [selected, setSelected] = useState("1"),
    [logos, rawSetLogos] = useState<Record<string, string>>({}),
    [background, rawSetBackground] = useState(`${PUBLIC_BASE}/arka-plan.png`),
    [scale, setScale] = useState(0.48),
    [notice, setNotice] = useState("Kulüp logoları hazır"),
    [page, setPage] = useState(0),
    [quickOpen, setQuickOpen] = useState(false),
    [logoManagerOpen, setLogoManagerOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [history, setHistory] = useState<DraftSnapshot[]>([]),
    [exporting, setExporting] = useState(false);
  const [importBook, setImportBook] = useState(null);
  const [eventQuery,setEventQuery]=useState(""),[eventDay,setEventDay]=useState(""),[chromeHeight,setChromeHeight]=useState(135);
  useEffect(()=>{const measure=()=>{setChromeHeight((document.querySelector(".topbar")?.getBoundingClientRect().height||76)+(document.querySelector(".studio-tools-bar")?.getBoundingClientRect().height||59));};const ro=new ResizeObserver(measure);for(const el of document.querySelectorAll(".topbar,.studio-tools-bar"))ro.observe(el);measure();return()=>ro.disconnect();},[]);
  const [logoNames,setLogoNames]=useState({});
  const [rememberedPlaces, setRememberedPlaces] = useState([]);
  useEffect(()=>{try { setRememberedPlaces(JSON.parse(localStorage.getItem("sks-place-suggestions-v1")||"[]")); }catch{}},[]);
  useEffect(()=>{if(!hydrated.current)return;setRememberedPlaces(previous=>{const next=Array.from(new Map([...previous,...events].map(e=>[e.location+"|"+e.campus,{location:e.location,campus:e.campus}])).values()).slice(-300);try{localStorage.setItem("sks-place-suggestions-v1",JSON.stringify(next));}catch{}return next;});},[events]);
  const [settings, rawSetSettings] = useState<any>({logoShape:"circle"});
  const [zoomMode,setZoomMode] = useState("fit"), [manualZoom,setManualZoom] = useState(1),[focusPreview,setFocusPreview] = useState(false);
  const [pageMetrics,setPageMetrics] = useState<any>({post:{heights:{},budget:760,gap:14},story:{heights:{},budget:1400,gap:20}});
  const probeRef=useRef<HTMLDivElement>(null),builtinLogos=useRef({});
  const [preflight,setPreflight]=useState(null),[inspectCard,setInspectCard]=useState(false);
  const undoRef=useRef([]),redoRef=useRef([]),projectRef=useRef({events,logos,background,settings});
  const autoStarted=useRef(false),exportLock=useRef(false);
  const writerId=useRef(""),conflictRef=useRef(false),lastUndo=useRef({at:0,field:""}),cancelExport=useRef(false);
  const [saveStatus,setSaveStatus]=useState("Çalışma açılıyor"),[conflict,setConflict]=useState(null);
  function persistProject(p){if(!hydrated.current||conflictRef.current)return;try{let existing;try{existing=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");}catch{}if(existing&&projectSignature(existing)===projectSignature(p)){setSaveStatus("Kaydedildi");return;}localStorage.setItem(DRAFT_KEY,JSON.stringify({...p,savedAt:new Date().toISOString(),writer:writerId.current}));setSaveStatus("Kaydedildi");}catch{setSaveStatus("Kaydedilemedi · Proje yedeği indirin");setNotice("Depolama dolu. Proje yedeğini indirin; Proje yedeği ekranından otomatik geçmişi temizleyebilirsiniz.");}}
  const [undoVersion,setUndoVersion]=useState(0);
  projectRef.current={events,logos,background,settings};
  function applyProject(p){projectRef.current=p;rawSetEvents(p.events);rawSetLogos(p.logos||{});rawSetBackground(p.background??"");rawSetSettings(p.settings||{logoShape:"circle"});setSelected(current=>p.events.some(e=>e.id===current)?current:(p.events[0]?.id||""));}
  function commitProject(patch){if(conflictRef.current||exportLock.current)return;const prev=projectRef.current;if(Object.entries(patch).every(([k,v])=>prev[k]===v))return;const next={...prev,...patch};const focused=document.activeElement,field=focused?.matches('input,textarea')?(selected+":"+(focused.getAttribute('aria-label')||focused.closest('label')?.textContent||focused.tagName)):"";const now=Date.now();if(!field||lastUndo.current.field!==field||now-lastUndo.current.at>1200)undoRef.current=[...undoRef.current,prev].slice(-40);lastUndo.current={at:now,field};redoRef.current=[];applyProject(next);persistProject(next);setUndoVersion(v=>v+1);}
  function setEvents(value){commitProject({events:typeof value==="function"?value(projectRef.current.events):value});}
  function setLogos(value){commitProject({logos:typeof value==="function"?value(projectRef.current.logos):value});}
  function setBackground(value){commitProject({background:typeof value==="function"?value(projectRef.current.background):value});}
  function undoEvents(){const p=undoRef.current.pop();if(!p)return;redoRef.current.push(projectRef.current);applyProject(p);setUndoVersion(v=>v+1);setNotice("Değişiklik geri alındı: etkinlik, logo ve arka plan birlikte geri yüklendi");}
  function redoEvents(){const p=redoRef.current.pop();if(!p)return;undoRef.current.push(projectRef.current);applyProject(p);setUndoVersion(v=>v+1);setNotice("Değişiklik yeniden uygulandı");}
  const displayedScale=zoomMode==="fit"?scale:zoomMode==="width"?manualZoom:manualZoom;
  const previewWrap = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null),
    dragged = useRef<string | null>(null),
    hydrated = useRef(false);
  const grouped = useMemo(
    () =>
      Object.entries(
        events.reduce<Record<string, EventItem[]>>((a, e) => {
          (a[e.date] ??= []).push(e);
          return a;
        }, {}),
      )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([date, items]) =>
            [
              date,
              items.sort(
                (a, b) =>
                  ((a.order ?? Infinity) - (b.order ?? Infinity)) || startTime(a.time)-startTime(b.time),
              ),
            ] as [string, EventItem[]],
        ),
    [events],
  );
  const mailHeight = useMemo(
    () =>
      Math.max(
        1120,
        305 +
          grouped.reduce(
            (total, [, items]) =>
              total + 72 + Math.ceil(items.length / 4) * 210,
            0,
          ),
      ),
    [grouped],
  );
  const f =
    format === "mail" ? { ...FORMATS.mail, h: mailHeight } : FORMATS[format];
  const postPages=useMemo<EventItem[][]>(()=>packPages(grouped,pageMetrics.post.heights,pageMetrics.post.budget,pageMetrics.post.gap),[grouped,pageMetrics]);
  const storyPages=useMemo<EventItem[][]>(()=>packPages(grouped,pageMetrics.story.heights,pageMetrics.story.budget,pageMetrics.story.gap),[grouped,pageMetrics]);
  const socialPages=format==="story"?storyPages:postPages;
  useEffect(()=>{setPage(p=>Math.max(0,Math.min(p,socialPages.length-1)));},[socialPages.length]);
  useEffect(()=>{let disposed=false;const measure=()=>{if(disposed||!probeRef.current)return;const result:any={};for(const kind of ["post","story"]){const root=probeRef.current.querySelector(`[data-probe="${kind}"]`);if(!root)continue;const heights={};root.querySelectorAll<HTMLElement>('[data-measure-id]').forEach(el=>heights[el.dataset.measureId]=el.offsetHeight);const body=root.querySelector('.design-body'),grid=root.querySelector('.cards-grid'),day=root.querySelector<HTMLElement>('.day-label'),style=getComputedStyle(body);const gap=grid?parseFloat(getComputedStyle(grid).rowGap)||14:14;const budget=(kind==="post"?1350:1920)-root.querySelector<HTMLElement>('.design-header').offsetHeight-root.querySelector<HTMLElement>('.design-footer').offsetHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-(day?.offsetHeight||44)-20;result[kind]={heights,budget,gap};}setPageMetrics(old=>JSON.stringify(old)===JSON.stringify(result)?old:result);};document.fonts.ready.then(measure);const observer=new ResizeObserver(measure);if(probeRef.current)observer.observe(probeRef.current);window.addEventListener('resize',measure);return()=>{disposed=true;observer.disconnect();window.removeEventListener('resize',measure);};},[events,logos,settings]);
  const visibleGrouped = useMemo(() => {
    if (format !== "post" && format !== "story") return grouped;
    return Object.entries(
      (socialPages[Math.min(page, socialPages.length - 1)] || []).reduce<
        Record<string, EventItem[]>
      >((a, e) => {
        (a[e.date] ??= []).push(e);
        return a;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b));
  }, [format, grouped, page, socialPages]);
  useEffect(() => {
    try {
      writerId.current=crypto.randomUUID();
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      const checked=raw?validateProject(raw):null,saved=checked?.project;
      if(checked?.warnings.length)setNotice(checked.warnings.join(" "));
      const savedHistory = readHistory(JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]"));
      if (Array.isArray(saved?.events)) {
        rawSetEvents(saved.events);
        setSelected(saved.events[0]?.id||"");
      }
      if (saved?.logos) rawSetLogos((current) => ({ ...current, ...saved.logos }));
      if (typeof saved?.background==="string") rawSetBackground(saved.background);
      if(saved?.settings){const old=JSON.parse(localStorage.getItem("sks-share-edits-v1")||"null");rawSetSettings({...saved.settings,...(!Object.keys(saved.settings.shareDraft?.texts||{}).length&&old?.texts?{shareDraft:old}:{})});}
      setHistory(savedHistory.filter(p=>{try{validateProject(p);return true;}catch{return false;}}));
      if (Array.isArray(saved?.events)) setNotice("Son çalışma geri yüklendi");
    } catch {
      try{const raw=localStorage.getItem(DRAFT_KEY);if(raw)localStorage.setItem("sks-recovery-draft",raw);}catch{}
      setNotice("Kayıtlı taslak geçersiz; örnek çalışma açıldı. Proje yedeği ekranından kurtarma dosyasını indirin.");
    } finally {
      hydrated.current = true;setSaveStatus("Kaydedildi");
    }
  }, []);
  useEffect(() => {
    if(!autoStarted.current){autoStarted.current=true;return;}
    if (!hydrated.current||conflictRef.current) return;
    persistProject(projectRef.current);
    const timer = window.setTimeout(() => {
      if(conflictRef.current)return;
      try {
        persistProject(projectRef.current);
        const previous = readHistory(JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]"));
        const signature = JSON.stringify({events,logos,background,settings});
        if (JSON.stringify(previous[0]&&{events:previous[0].events,logos:previous[0].logos,background:previous[0].background,settings:previous[0].settings}) !== signature) {
          const snapshot: DraftSnapshot = {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            label: "Otomatik kayıt",
            events, logos, background, settings,
          };
          const next = [snapshot, ...previous].slice(0, 25);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(packHistory(next)));
          setHistory(next);
        }
      } catch {
        setNotice("Geçmiş kaydedilemedi. Proje yedeği ekranından otomatik geçmişi temizleyin veya yedek indirin.");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [events, logos, background, settings]);
  useEffect(()=>{const flush=()=>persistProject(projectRef.current);const storage=e=>{if(e.key!==DRAFT_KEY||!e.newValue)return;try{const raw=JSON.parse(e.newValue);if(raw.writer===writerId.current)return;const {project}=validateProject(raw);if(projectSignature(project)===projectSignature(projectRef.current))return;conflictRef.current=true;setConflict(project);setSaveStatus("Başka sekmede değişiklik var");}catch{setNotice("Diğer sekmedeki kayıt geçersiz; bu çalışma korundu.");}};window.addEventListener('pagehide',flush);window.addEventListener('storage',storage);return()=>{window.removeEventListener('pagehide',flush);window.removeEventListener('storage',storage);};},[]);
  useEffect(()=>{try{const p=JSON.parse(localStorage.getItem('sks-view-v1')||'null');if(p){setZoomMode(['fit','width','manual'].includes(p.mode)?p.mode:'fit');setManualZoom(Math.max(.1,Math.min(2,Number(p.zoom)||1)));}}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem('sks-view-v1',JSON.stringify({mode:zoomMode,zoom:manualZoom}));}catch{}},[zoomMode,manualZoom]);
  useEffect(()=>{let dialog=null,previous=null;const focusable=()=>dialog?[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length):[];const observer=new MutationObserver(()=>{const next=[...document.querySelectorAll('[role="dialog"]')].at(-1);if(next!==dialog){if(!next){previous?.focus?.();dialog=null;return;}previous=document.activeElement;dialog=next;focusable()[0]?.focus();}});observer.observe(document.body,{childList:true,subtree:true});const keys=e=>{if(!dialog)return;if(e.key==='Escape'){const close=[...dialog.querySelectorAll('button')].find(b=>/kapat|×/i.test(b.textContent+' '+b.getAttribute('aria-label')));if(close){e.preventDefault();close.click();}}if(e.key==='Tab'){const a=focusable(),first=a[0],last=a.at(-1);if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',keys);return()=>{observer.disconnect();document.removeEventListener('keydown',keys);};},[]);
  useEffect(() => {
    setPage(0);
  }, [format, events.length]);
  useEffect(() => {
    const update = () => {
      if (!previewWrap.current) return;
      const stage = previewWrap.current.querySelector(".canvas-stage");
      const b = (stage || previewWrap.current).getBoundingClientRect();
      const height = canvas.current?.offsetHeight || f.h;
      setScale(Math.min((b.width - 48) / f.w, (b.height - 48) / height, 1));
      if(zoomMode==="width")setManualZoom(Math.max(.1,(b.width-48)/f.w));
    };
    update();
    const o = new ResizeObserver(update);
    if (previewWrap.current) o.observe(previewWrap.current);
    if (canvas.current) o.observe(canvas.current);
    return () => o.disconnect();
  }, [f.w, f.h,zoomMode,focusPreview]);
  useEffect(() => {
    fetch(`${PUBLIC_BASE}/logo-eslestirme-tablosu.csv`)
      .then((r) => {if(!r.ok)throw new Error("Logo listesi yüklenemedi");return r.text();})
      .then((text) => {
        const builtins: Record<string, string> = {},names={};
        text
          .replace(/^\uFEFF/, "")
          .split(/\r?\n/)
          .slice(1)
          .forEach((line) => {
            const comma = line.indexOf(",");
            if (comma < 1) return;
            const file = line.slice(0, comma).trim(),
              name = line.slice(comma + 1).trim();
            if(file&&name){builtins[normalize(name)]=`${PUBLIC_BASE}/logos/${file}`;names[normalize(name)]=name;}
          });
        setLogoNames(names);builtinLogos.current=builtins;rawSetLogos((current) => ({ ...builtins, ...current }));
      })
      .catch(() => setNotice("Logolar yüklenemedi; özel klasör seçilebilir"));
  }, []);
  const range = useMemo(() => {
    const dates = events
      .map((e) => e.date)
      .filter(Boolean)
      .sort();
    if (!dates.length) return "HAFTA SEÇİLMEDİ";
    return `${displayDate(dates[0]).replace(/\s\d{4}$/, "")} – ${displayDate(dates.at(-1)!)}`.toLocaleUpperCase(
      "tr-TR",
    );
  }, [events]);
  const rangeExact = useMemo(()=>{const ds=events.map(e=>e.date).filter(Boolean).sort();if(!ds.length)return "Hafta seçilmedi";return `${displayDate(weekBounds(ds[0]).start)} – ${displayDate(weekBounds(ds.at(-1)).end)}`;},[events]);
  function addHistory(label: string, items: EventItem[]) {
    const snapshot: DraftSnapshot = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label,
      events: items,logos,background,settings,
    };
    const next = [snapshot, ...history].slice(0, 25);
    setHistory(next);
    try{localStorage.setItem(HISTORY_KEY, JSON.stringify(packHistory(next)));}catch{setNotice("Geçmiş kaydedilemedi; Proje yedeği ile çalışmayı indirin.");}
  }
  function restoreHistory(snapshot: DraftSnapshot) {
    addHistory("Geri yüklemeden önce", events);
    commitProject({events:snapshot.events,...(snapshot.logos?{logos:snapshot.logos}:{}),...(typeof snapshot.background==="string"?{background:snapshot.background}:{}),...(snapshot.settings?{settings:snapshot.settings}:{})});
    setSelected(snapshot.events[0]?.id || "");
    setHistoryOpen(false);
    setNotice(
      `${new Date(snapshot.at).toLocaleString("tr-TR")} sürümü geri yüklendi`,
    );
  }
  const fileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  async function importExcel(file?: File) {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), {type:"array", cellDates:false});
      if (!wb.SheetNames.length) throw new Error("Excel'de sekme bulunamadı");
      setImportBook(wb);
    } catch { setNotice("Excel okunamadı; geçerli bir XLSX dosyası seçin"); }
  }
  async function importLogos(files: FileList | null) {
    if(!files)return;const next={},warnings=[];for(const file of Array.from(files)){try{const image=await prepareImage(file,{trim:settings.trimLogos||false});next[normalize(file.name.replace(/\.[^.]+$/,""))]=image.data;if(image.warning)warnings.push(file.name+": "+image.warning);}catch(e){warnings.push(file.name+": "+e.message);}}if(Object.keys(next).length)setLogos(p=>({...p,...next}));setNotice(`${Object.keys(next).length} logo alındı. ${warnings.join(" · ")}`);
  }
  async function replaceClubLogo(club:string,file?:File){if(!file)return;try{const image=await prepareImage(file,{trim:settings.trimLogos||false});setLogos(p=>({...p,[normalize(club)]:image.data}));setNotice(image.warning||`${club} logosu güncellendi`);}catch(e){setNotice(e.message);}}
  function resetClubLogo(club){const key=normalize(club);setLogos(p=>{const next={...p};delete next[key];if(builtinLogos.current[key])next[key]=builtinLogos.current[key];return next;});}
  function update(id: string, key: keyof EventItem, value: string) {
    if((key==="date"||key==="endDate"&&value)&&!validDate(value)){setNotice("Geçerli bir tarih seçin");return;}
    setEvents((current) => {
      const old = current.find((e) => e.id === id);
      if (!old) return current;
      const nextDate = key === "date" ? value : old.date,
        resetOrder = key === "date" || key === "time";
      return current.map((e) => {
        if (e.id === id)
          return {
            ...e,
            [key]: value,
            order: resetOrder ? undefined : e.order,
          };
        if (resetOrder && (e.date === old.date || e.date === nextDate))
          return { ...e, order: undefined };
        return e;
      });
    });
  }
  function addEvent() {
    const id = crypto.randomUUID();
    setEvents((v) => [
      ...v,
      {
        id,
        club: "Yeni Kulüp",
        title: "Yeni Etkinlik",
        date: v.at(-1)?.date || new Date().toLocaleDateString("en-CA"),
        time: "12.00–13.00",
        speaker: "",
        campus: "Merkez Yerleşkesi",
        location: "",
      },
    ]);
    setSelected(id);
    setQuickOpen(true);
  }
  function selectForEdit(id: string) {
    setSelected(id);
    setQuickOpen(true);
  }
  function moveEvent(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const sourceDay=events.find(e=>e.id===sourceId)?.date,targetDay=events.find(e=>e.id===targetId)?.date;
    if(sourceDay!==targetDay){setNotice("Gün değiştirmek için tarih alanını düzenleyin; sürükleme yalnızca aynı gün içindir.");return;}
    setEvents((current) => {
      const source = current.find((e) => e.id === sourceId),
        target = current.find((e) => e.id === targetId);
      if (!source || !target) return current;
      if(source.date!==target.date){setNotice("Sıralama yalnızca aynı gün içinde yapılır. Tarihi düzenleme ekranından değiştirin.");return current;}
      const moved = current,
        day = moved
          .filter((e) => e.date === target.date)
          .sort(
            (a, b) =>
              ((a.order ?? Infinity) - (b.order ?? Infinity)) || startTime(a.time)-startTime(b.time),
          ),
        without = day.filter((e) => e.id !== sourceId),
        targetIndex = Math.max(
          0,
          without.findIndex((e) => e.id === targetId),
        ),
        ordered = [
          ...without.slice(0, targetIndex),
          moved.find((e) => e.id === sourceId)!,
          ...without.slice(targetIndex),
        ];
      const ranks = new Map(ordered.map((e, i) => [e.id, i]));
      return moved.map((e) =>
        ranks.has(e.id) ? { ...e, order: ranks.get(e.id) } : e,
      );
    });
    setNotice("Kart sırası güncellendi");
  }
  function download(){const name=format==="mail"?"01-mail-bulteni.png":format==="summary"?"04-haftalik-ozet.png":format==="summaryStory"?"05-haftalik-ozet-story.png":format==="post"?`02-post-sayfa-${page+1}.png`:`03-story-sayfa-${page+1}.png`;runExport([name],false);}
  function downloadAll(names=null){runExport(Array.isArray(names)?names:null,true);}
  async function runExport(names,zipMode,approved=false){
    let snapshotHost:HTMLDivElement=null;
    if(exporting)return;cancelExport.current=false;exportLock.current=true;setExporting(true);setNotice("Görseller ve içerik kontrol ediliyor…");
    try{const nodes=Array.from(document.querySelectorAll<HTMLElement>('[data-export-name]')).filter(n=>!names||names.includes(n.dataset.exportName));if(!nodes.length)throw Error("İndirilecek sayfa yok.");await document.fonts.ready;await Promise.all(nodes.flatMap(n=>Array.from(n.querySelectorAll('img')).map(img=>img.decode().catch(()=>undefined))));
      const selectedIds=new Set(nodes.flatMap(n=>[...n.querySelectorAll<HTMLElement>("[data-event-id]")].map(c=>c.dataset.eventId))),exportEvents=selectedIds.size?events.filter(e=>selectedIds.has(e.id)):events;const issues=inspectNodes(nodes);for(const e of exportEvents){for(const message of rowIssues(e))issues.push({name:e.title||"Etkinlik",level:message.includes("Tarih")||message.includes("Kulüp eksik")||message.includes("Etkinlik adı")?"error":"warning",message});}for(let i=0;i<exportEvents.length;i++){const e=exportEvents[i];if(exportEvents.findIndex(x=>duplicateKey(x)===duplicateKey(e))<i)issues.push({name:e.title,level:"warning",message:"Aynı kulüp, tarih ve saatte tekrarlanan etkinlik var."});}const weeks=new Set(events.map(e=>weekBounds(e.date).start));if(weeks.size>1&&nodes.some(n=>n.classList.contains('summary')))issues.push({name:"Haftalık özet",level:"error",message:"Özet tek haftalıktır. Hafta ve arşiv ekranından bir hafta seçin."});if(!events.length)issues.push({name:"Çalışma",level:"error",message:"En az bir etkinlik ekleyin."});
      if(issues.some(x=>x.level==="error")||(!approved&&issues.length)){setPreflight({issues,names,zip:zipMode});setNotice("İndirme öncesi kontrol sonuçlarını inceleyin");return;}
      snapshotHost=document.createElement('div');snapshotHost.style.cssText='position:fixed;left:-30000px;top:0;pointer-events:none;';snapshotHost.dataset.logoShape=settings.logoShape;document.querySelector('main').appendChild(snapshotHost);const snapshots=nodes.map(node=>{const copy=node.cloneNode(true) as HTMLElement;copy.style.transform='none';snapshotHost.appendChild(copy);return copy;});const zip=new JSZip();for(let i=0;i<nodes.length;i++){if(cancelExport.current)throw Error("Kullanıcı tarafından iptal edildi.");const node=snapshots[i],width=Number(node.dataset.exportWidth),height=node.classList.contains('mail')?Math.ceil(Math.max(node.offsetHeight,node.scrollHeight)):Number(node.dataset.exportHeight);setNotice(`${i+1} / ${nodes.length} görsel hazırlanıyor…`);const data=await toPng(node,{cacheBust:true,pixelRatio:1,width,height,style:{transform:"none",height:`${height}px`}});if(cancelExport.current)throw Error('Kullanıcı tarafından iptal edildi.');if(zipMode)zip.file(node.dataset.exportName,data.split(',')[1],{base64:true});else{const a=document.createElement('a');a.href=data;a.download=node.dataset.exportName;a.click();}}
      if(zipMode){if(cancelExport.current)throw Error("Kullanıcı tarafından iptal edildi.");const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},()=>{if(cancelExport.current)throw Error("Kullanıcı tarafından iptal edildi.");}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sks-etkinlik-${events.map(e=>e.date).sort()[0]||"tasarimlar"}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}setNotice(`${nodes.length} görsel için indirme başlatıldı`);
    }catch(e){setNotice(`İndirme tamamlanamadı: ${e.message||"Yeniden deneyin"}`);}finally{snapshotHost?.remove();exportLock.current=false;setExporting(false);}
  }

  const selectedEvent=events.find(e=>e.id===selected)||events[0];
  const usedClubs = Array.from(
    new Set(events.flatMap((event) => splitClubs(event.club))),
  ).sort((a, b) => a.localeCompare(b, "tr-TR"));
  return (
    <main className="studio-shell" data-logo-shape={settings.logoShape}>
      <div className="save-status" role="status">{saveStatus}</div>
      {conflict&&<div className="tools-backdrop"><section className="tools-dialog" role="dialog" aria-modal="true" aria-label="Sekmeler arasında kayıt çakışması"><header><h2>Başka sekmede çalışma değişti</h2></header><div className="tools-body"><p>Bu sekmenin otomatik kaydı durduruldu. Kullanılacak sürümü seçin. Kendi sürümünüzü korumadan önce diğer sekmeyi kapatın.</p><button onClick={()=>{conflictRef.current=false;applyProject(conflict);setConflict(null);setSaveStatus("Diğer sekmenin sürümü açıldı");}}>Diğer sekmenin sürümünü aç</button><button onClick={()=>{conflictRef.current=false;setConflict(null);persistProject(projectRef.current);}}>Bu sekmenin sürümünü koru</button></div></section></div>}
      {exporting&&<div className="export-lock" role="dialog" aria-modal="true" aria-label="İndirme hazırlanıyor"><p>{notice}</p><button onClick={()=>{cancelExport.current=true;setNotice("İptal ediliyor…");}}>İndirmeyi iptal et</button></div>}
      {inspectCard&&selectedEvent&&<div className="tools-backdrop"><section role="dialog" aria-modal="true" aria-label="Etkinlik kartı inceleme" className="tools-dialog card-inspection"><header><h2>Etkinlik kartı · Büyük inceleme</h2><button onClick={()=>setInspectCard(false)}>Kapat</button></header><div className="tools-body"><div className="design-canvas post" style={{width:1080,height:"auto",padding:24}}><EventCard event={selectedEvent} logos={logos} onSelect={()=>{setInspectCard(false);setQuickOpen(true);}} onMove={()=>{}} dragged={dragged}/></div></div></section></div>}
      {preflight&&<ExportReview issues={preflight.issues} busy={exporting} onClose={()=>setPreflight(null)} onContinue={()=>{const p=preflight;setPreflight(null);runExport(p.names,p.zip,true);}}/>}
      {importBook && <ExcelImport book={importBook} onClose={()=>setImportBook(null)} onImport={items=>{addHistory("Excel aktarımı öncesi",events);setEvents(items);setSelected(items[0]?.id||"");setImportBook(null);setNotice(`${items.length} etkinlik kontrol edilerek aktarıldı`);}}/>}
      {quickOpen && selectedEvent && (
        <QuickEditor
          event={selectedEvent}
          onClose={() => setQuickOpen(false)}
          onUpdate={(key, value) => update(selectedEvent.id, key, value)}
          suggestions={[...rememberedPlaces,...events]}
          clubNames={Array.from(new Set<string>([...usedClubs,...Object.values(logoNames) as string[]]))}
          logos={logos} trimLogos={settings.trimLogos||false} onImageError={setNotice}
          onDelete={() => {
            setEvents((v) => v.filter((e) => e.id !== selected));
            setQuickOpen(false);
          }}
        />
      )}
      {logoManagerOpen && (
        <LogoManager
          clubs={usedClubs}
          names={logoNames}
          logos={logos}
          onClose={() => setLogoManagerOpen(false)}
          onReplace={replaceClubLogo}
          onReset={resetClubLogo}
          onMatch={(club,key)=>setLogos(p=>({...p,[normalize(club)]:p[key]}))}
          trimLogos={settings.trimLogos||false} onTrim={value=>commitProject({settings:{...settings,trimLogos:value}})} logoShape={settings.logoShape} onShape={value=>commitProject({settings:{...settings,logoShape:value}})}
          onFolder={importLogos}
        />
      )}
      {historyOpen && (
        <HistoryPanel
          history={history}
          onClose={() => setHistoryOpen(false)}
          onRestore={restoreHistory}
        />
      )}
      <header className="topbar">
        <div className="brand-mark">SKS</div>
        <div>
          <h1>Etkinlik Stüdyosu</h1>
          <p>2026–2027 Akademik Yılı</p>
        </div>
        <div className="top-actions">
          <span className="status">
            <i /> {notice}
          </span>
          <button
            className="download secondary"
            onClick={() => setHistoryOpen(true)}
          >
            Geçmiş
          </button>
          <button
            className="download secondary"
            disabled={exporting}
            onClick={() => downloadAll()}
          >
            <Archive size={18} /> {exporting ? "Hazırlanıyor…" : "Tümünü İndir"}
          </button>
          <button className="download" disabled={exporting} onClick={download}>
            <Download size={18} /> PNG İndir
          </button>
        </div>
      </header>
      <StudioTools events={events} setEvents={setEvents} logos={logos} setLogos={setLogos} background={background} setBackground={setBackground} onNotice={setNotice} onUndo={undoEvents} onRedo={redoEvents} canUndo={undoRef.current.length>0} canRedo={redoRef.current.length>0} onExport={downloadAll} settings={settings} onRestoreProject={p=>commitProject(validateProject(p).project)} onSettings={value=>commitProject({settings:value})} rangeLabel={rangeExact}/>
      <div className="workspace">
        <aside className="controls">
          <section className="control-section">
            <Title n="01" title="Çıktı formatı" sub="Tasarım türünü seç" />
            <div className="format-grid">
              {(Object.entries(FORMATS) as [Format, typeof f][]).map(
                ([key, item]) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={key}
                      className={format === key ? "active" : ""}
                      onClick={() => setFormat(key)}
                    >
                      <Icon size={17} />
                      <b>{item.label}</b>
                      <small>{item.size}</small>
                    </button>
                  );
                },
              )}
            </div>
          </section>
          <section className="control-section">
            <Title
              n="02"
              title="İçerik kaynakları"
              sub="Excel, logo ve arka plan"
            />
            <label className="upload-row">
              <span className="upload-icon excel">
                <Upload size={18} />
              </span>
              <span>
                <b>Excel’i içe aktar</b>
                <small>SKS Etkinlik İstatistik şablonu</small>
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e=>{importExcel(e.target.files?.[0]);e.target.value="";}}
              />
              <ChevronDown size={17} />
            </label>
            <button
              type="button"
              className="upload-row"
              onClick={() => setLogoManagerOpen(true)}
            >
              <span className="upload-icon logos">
                <UsersRound size={18} />
              </span>
              <span>
                <b>Kulüp logoları klasörü</b>
                <small>
                  {Object.keys(logos).length
                    ? `${Object.keys(logos).length} logo yüklendi`
                    : "Dosya adına göre otomatik eşleşir"}
                </small>
              </span>
              <ChevronDown size={17} />
            </button>
            <label className="upload-row">
              <span className="upload-icon bg">
                <ImageIcon size={18} />
              </span>
              <span>
                <b>Arka planı değiştir</b>
                <small>JPG veya PNG · isteğe bağlı</small>
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const x = e.target.files?.[0];
                  if(x){try{const image=await prepareImage(x,{background:true});setBackground(image.data);if(image.warning)setNotice(image.warning);}catch(err){setNotice(err.message);}}
                }}
              />
              <ChevronDown size={17} />
            </label>
          </section>
          <section className="control-section events-panel">
            <div className="section-title row">
              <span>03</span>
              <div>
                <b>Etkinlikler</b>
                <small>{events.length} kayıt · alanlar düzenlenebilir</small>
              </div>
              <button className="icon-btn" aria-label="Yeni etkinlik ekle" title="Yeni etkinlik ekle" onClick={addEvent}>
                <Plus size={18} />
              </button>
            </div>
            <div className="event-filters"><input aria-label="Etkinlik veya kulüp ara" placeholder="Etkinlik veya kulüp ara" value={eventQuery} onChange={e=>setEventQuery(e.target.value)}/><input aria-label="Etkinlik günü filtresi" type="date" value={eventDay} onChange={e=>setEventDay(e.target.value)}/></div>
            <div className="event-list">
              {events.filter(e=>(!eventDay||e.date===eventDay)&&normalize(e.club+e.title).includes(normalize(eventQuery))).map((e) => (
                <button
                  key={e.id}
                  onClick={() => selectForEdit(e.id)}
                  className={`event-row ${selected === e.id ? "active" : ""}`}
                  style={
                    {
                      "--event-color": getCampus(e.campus).color,
                    } as React.CSSProperties
                  }
                >
                  <div className="mini-logo">
                    <span className="mini-logos">{splitClubs(e.club).map((club,i)=><ClubLogo key={club} name={club} logos={logos} small override={i===0?e.logoOverride:undefined}/>)}</span>
                  </div>
                  <span>
                    <b>{e.title}</b>
                    <small>
                      {e.club} · {e.time}
                    </small>
                  </span>
                  <ChevronDown size={15} />
                </button>
              ))}
            </div>
          </section>
        </aside>
        <section className={`preview-area ${focusPreview?"focus-preview":""}`} ref={previewWrap} style={{ height: focusPreview?"100dvh":`calc(100dvh - ${chromeHeight}px)`, top: 0 }}>
          <div className="preview-toolbar">
            <div>
              <b>Canlı önizleme</b>
              <small>
                {f.label} · %{Math.round(displayedScale * 100)} ölçek
              </small>
            </div>
            {(format === "post" || format === "story") && (
              <div className="page-nav">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft />
                </button>
                <b>
                  {page + 1} / {socialPages.length}
                </b>
                <button
                  disabled={page >= socialPages.length - 1}
                  onClick={() =>
                    setPage((p) => Math.min(socialPages.length - 1, p + 1))
                  }
                >
                  <ChevronRight />
                </button>
              </div>
            )}
            <div className="zoom-tools" title="Kartı düzenlemek için tıklayın. Yakın görünümde alanı sürükleyerek gezinin."><button disabled={!selectedEvent} onClick={()=>setInspectCard(true)}>Seçili kartı incele</button><button aria-label="Uzaklaştır" onClick={()=>{setZoomMode("manual");setManualZoom(Math.max(.1,displayedScale-.1));}}>−</button><select aria-label="Yakınlaştırma" value={zoomMode==="fit"?"fit":zoomMode==="width"?"width":String(Math.round(manualZoom*100))} onChange={e=>{if(e.target.value==="fit"||e.target.value==="width")setZoomMode(e.target.value);else{setZoomMode("manual");setManualZoom(Number(e.target.value)/100);}}}><option value="fit">Ekrana sığdır</option><option value="width">Genişliğe sığdır</option>{Array.from(new Set([25,50,75,100,125,150,200,Math.round(manualZoom*100)])).sort((a,b)=>a-b).map(z=><option key={z} value={z}>%{z}</option>)}</select><button aria-label="Yakınlaştır" onClick={()=>{setZoomMode("manual");setManualZoom(Math.min(2,displayedScale+.1));}}>+</button><button onClick={()=>setFocusPreview(!focusPreview)}>{focusPreview?"Geniş görünümü kapat":"Geniş görünüm"}</button></div>
            <div className="legend">
              {[CAMPUS.merkez, CAMPUS.güney, CAMPUS.np, CAMPUS.çarşı,{key:"Diğer",color:"#B41655"},{key:"Çevrimiçi",color:"#107F88"}].map(
                (x) => (
                  <span key={x.key}>
                    <i style={{ background: x.color }} />
                    {x.key}
                  </span>
                ),
              )}
            </div>
          </div>
          <ZoomView scale={displayedScale} mode={zoomMode} width={f.w} height={canvas.current?.offsetHeight||f.h}>
            <div
              className={`design-canvas ${format === "summaryStory" ? "summary summary-story" : format}`}
              ref={canvas}
              style={{
                width: f.w,
                height: format === "mail" ? "auto" : f.h,
                minHeight: format === "mail" ? mailHeight : undefined,
                transform: `scale(${displayedScale})`,
                backgroundImage: background
                  ? `linear-gradient(180deg,rgba(5,40,29,.82),rgba(5,26,21,.94)),url(${background})`
                  : undefined,
              }}
            >
              <DesignHeader
                range={
                  (format === "post" || format === "story") &&
                  socialPages[page]?.[0]
                    ? displayDate(socialPages[page][0].date)
                    : rangeExact
                }
                count={
                  format === "post" || format === "story"
                    ? socialPages[page]?.length || 0
                    : events.length
                }
              />
              {format === "summary" || format === "summaryStory" ? (
                <SummaryGrid events={events} logos={logos} />
              ) : (
                <EventDesign
                  grouped={visibleGrouped}
                  logos={logos}
                  format={format}
                  onSelect={selectForEdit}
                  onMove={moveEvent}
                  dragged={dragged}
                />
              )}
              <DesignFooter />
            </div>
          </ZoomView>
        </section>
      </div>
      <div ref={probeRef} className="layout-probes" aria-hidden="true">{["post","story"].map(kind=><div key={kind} data-probe={kind} className={`design-canvas ${kind}`} style={{width:1080,height:"auto",overflow:"visible"}}><DesignHeader range={rangeExact} count={events.length}/><div className="design-body"><div className="day-label"><b>Pazartesi</b></div><div className="cards-grid">{events.map(e=><div key={e.id} data-measure-id={e.id}><EventCard event={e} logos={logos} onSelect={()=>{}} onMove={()=>{}} dragged={dragged}/></div>)}</div></div><DesignFooter/></div>)}</div>
      <BatchExports
        grouped={grouped}
        pages={postPages}
        storyPages={storyPages}
        events={events}
        logos={logos}
        background={background}
        range={rangeExact}
        mailHeight={mailHeight}
      />
    </main>
  );
}
function LogoManager({clubs,logos,names,onClose,onReplace,onFolder,onReset,onMatch,logoShape,onShape,trimLogos,onTrim}){
 const [query,setQuery]=useState(""),[onlyUsed,setOnlyUsed]=useState(true),[aliasName,setAliasName]=useState(""),[aliasTarget,setAliasTarget]=useState("");
 const roster=Array.from(new Set<string>([...clubs,...(onlyUsed?[]:Object.values(names) as string[])])).sort((a,b)=>a.localeCompare(b,"tr-TR"));
 return <div className="quick-editor-backdrop manager-backdrop"><section className="asset-manager" role="dialog" aria-modal="true" aria-label="Kulüp logolarını yönet"><header><div><b>Kulüp logolarını yönet</b><small>Belirsiz adlarda doğru logoyu seçin. Tam eşleşmeler önceliklidir.</small></div><button aria-label="Logo yönetimini kapat" onClick={onClose}>×</button></header><div className="manager-tools"><input aria-label="Kulüp ara" placeholder="Kulüp ara…" value={query} onChange={e=>setQuery(e.target.value)}/><label>Logo klasörü yükle<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple {...{webkitdirectory:""}} onChange={e=>onFolder(e.target.files)}/></label></div><div className="manager-settings"><label><input type="checkbox" checked={onlyUsed} onChange={e=>setOnlyUsed(e.target.checked)}/>Yalnızca bu çalışmadaki kulüpler</label><label>Logo çerçevesi<select value={logoShape} onChange={e=>onShape(e.target.value)}><option value="circle">Daire</option><option value="square">Yuvarlatılmış kare</option></select></label><label><input type="checkbox" checked={trimLogos} onChange={e=>onTrim(e.target.checked)}/>Yeni yüklemelerde beyaz / şeffaf kenarları kırp</label><p>En fazla 10 MB. Kırpma kapalıysa orijinal oran ve boşluklar korunur. Değişikliği görmek için logoyu yeniden yükleyin.</p></div><div className="manager-settings"><label>Alternatif kulüp adı<input value={aliasName} onChange={e=>setAliasName(e.target.value)}/></label><label>Bu adı kayıtlı logoyla eşleştir<select value={aliasTarget} onChange={e=>setAliasTarget(e.target.value)}><option value="">Logo seçin</option>{Object.keys(logos).map(k=><option key={k} value={k}>{names[k]||k}</option>)}</select></label><button disabled={!aliasName.trim()||!aliasTarget} onClick={()=>{onMatch(aliasName.trim(),aliasTarget);setAliasName("");}}>Alternatif adı kaydet</button></div><div className="club-logo-list">{roster.filter(n=>normalize(n).includes(normalize(query))).map(club=>{const r=resolveLogo(club,logos);return <div className="club-logo-item logo-edit-item" key={club}><ClubLogo name={club} logos={logos}/><div><b>{club}</b><small className={'match-'+r.status}>{logoStatus(r)}</small><label>Logo seç / değiştir<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>onReplace(club,e.target.files?.[0])}/></label><select aria-label={`${club} için logo eşleştir`} value={r.key||""} onChange={e=>{if(e.target.value)onMatch(club,e.target.value);}}><option value="">Kayıtlı logoyla eşleştir</option>{Object.keys(logos).sort((a,b)=>(names[a]||a).localeCompare(names[b]||b,"tr")).map(key=><option key={key} value={key}>{names[key]||key}{r.candidates?.includes(key)?" (benzer ad)":""}</option>)}</select><button onClick={()=>onReset(club)}>Varsayılana dön</button></div></div>})}</div></section></div>;
}

function HistoryPanel({
  history,
  onClose,
  onRestore,
}: {
  history: DraftSnapshot[];
  onClose: () => void;
  onRestore: (snapshot: DraftSnapshot) => void;
}) {
  return (
    <div className="quick-editor-backdrop manager-backdrop">
      <section className="asset-manager history-manager" role="dialog" aria-modal="true" aria-label="Çalışma geçmişi">
        <header>
          <div>
            <b>Çalışma geçmişi</b>
            <small>Son 25 sürüm; etkinlik, logo, arka plan ve tasarım ayarlarıyla saklanır.</small>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="history-list">
          {history.length ? (
            history.map((snapshot) => (
              <button key={snapshot.id} onClick={() => onRestore(snapshot)}>
                <span>
                  <b>{snapshot.label}</b>
                  <small>
                    {new Date(snapshot.at).toLocaleString("tr-TR")} ·{" "}
                    {snapshot.events.length} etkinlik
                  </small>
                </span>
                <em>Geri yükle</em>
              </button>
            ))
          ) : (
            <p>Henüz kayıtlı bir sürüm yok.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function QuickEditor({
  event,
  onClose,
  onUpdate,
  onDelete,
  suggestions,clubNames,logos,onImageError,trimLogos,
}: {
  event: EventItem;
  onClose: () => void;
  onUpdate: (key: keyof EventItem, value: string) => void;
  onDelete: () => void;
  suggestions: {location:string;campus:string}[];clubNames:string[];logos:any;onImageError:any;trimLogos:boolean;
}) {
  return (
    <div
      className="quick-editor-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="quick-editor" role="dialog" aria-modal="true" aria-label="Etkinliği düzenle">
        <header>
          <div>
            <b>Etkinliği düzenle</b>
            <small>Değişiklikler bütün tasarımlara uygulanır</small>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="quick-fields">
          <label className="wide">
            Etkinlik adı
            <input
              value={event.title}
              onChange={(e) => onUpdate("title", e.target.value)}
            />
          </label>
          <label className="wide">Kulüp adı<input value={event.club} onChange={e=>onUpdate("club",e.target.value)}/></label>
          <ClubPicker value={event.club} names={clubNames.filter(n=>n.includes(" "))} onChange={v=>onUpdate("club",v)}/>
          <p className="logo-hint">{splitClubs(event.club).map(n=>`${n}: ${logoStatus(resolveLogo(n,logos))}`).join(" · ")}</p>
          <label>
            Tarih
            <input
              type="date"
              value={event.date}
              onChange={(e) => onUpdate("date", e.target.value)}
            />
          </label>
          <label>Bitiş tarihi (geceyi aşan etkinlik)<input type="date" min={event.date} value={event.endDate||""} onChange={e=>onUpdate("endDate",e.target.value)}/></label>
          <label>
            Saat
            <input
              value={event.time}
              onChange={(e) => onUpdate("time", e.target.value)}
            />
          </label>
          <label className="wide">
            Mekân
            <input list="venue-options"
              value={event.location}
              onChange={(e) => onUpdate("location", e.target.value)}
            />
          </label>
          <datalist id="venue-options">{Array.from(new Set(suggestions.map(e=>e.location).filter(Boolean))).map(v=><option key={v} value={v}/>)}</datalist>
          <label className="wide">
            Yerleşke
            <input
              type="text"
              list="campus-options"
              value={event.campus}
              onChange={(e) => onUpdate("campus", e.target.value)}
              placeholder="Yerleşke veya platform adı yazın"
            />
            <datalist id="campus-options">
              {Array.from(new Set(suggestions.map(e=>e.campus).filter(Boolean))).map(v=><option key={v} value={v}/>)}
              <option value="Merkez Yerleşkesi" />
              <option value="Güney Yerleşkesi" />
              <option value="Çarşı Yerleşkesi" />
              <option value="NP Sağlık Yerleşkesi" />
              <option value="Diğer" />
              <option value="Kurum Dışı" />
              <option value="Çevrimiçi" />
              <option value="Zoom" />
              <option value="Microsoft Teams" />
            </datalist>
          </label>
          <label className="logo-change wide">
            <span>
              <b>Etkinlik logosu</b>
              <small>
                Yüklenen özel logo yalnızca bu etkinlikte kullanılır; kulübün diğer etkinlikleri etkilenmez.
              </small>
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const image=await prepareImage(file,{trim:trimLogos});onUpdate("logoOverride",image.data);if(image.warning)onImageError(image.warning);}catch(err){onImageError(err.message);}}}
            />
            <em>
              {event.logoOverride ? "Özel logo seçildi" : "Logo değiştir"}
            </em>
          </label>
          {event.logoOverride&&<button onClick={()=>onUpdate("logoOverride","")}>Etkinliğe özel logoyu kaldır</button>}
        </div>
        <footer>
          <button className="delete" onClick={onDelete}>
            <Trash2 size={15} /> Etkinliği sil
          </button>
          <button className="save" onClick={onClose}>
            Tamam
          </button>
        </footer>
      </section>
    </div>
  );
}
function Title({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="section-title">
      <span>{n}</span>
      <div>
        <b>{title}</b>
        <small>{sub}</small>
      </div>
    </div>
  );
}
function DesignHeader({ range }: { range: string; count: number }) {
  return (
    <header className="design-header">
      <div className="header-brand-logo">
        <img
          src={`${PUBLIC_BASE}/logos/uulogo-cropped.png`}
          alt="Üsküdar Üniversitesi"
        />
      </div>
      <div className="header-copy">
        <small>Sağlık, Kültür ve Spor Daire Başkanlığı</small>
        <strong>{range}</strong>
        <b>Öğrenci Kulübü Etkinlikleri</b>
      </div>
      <div className="header-brand-logo right">
        <img src={`${PUBLIC_BASE}/logos/skslogo.png`} alt="SKS" />
      </div>
    </header>
  );
}
function LogoGroup({
  club,
  logos,
  override,
}: {
  club: string;
  logos: Record<string, string>;
  override?: string;
}) {
  const clubs = splitClubs(club);
  return (
    <div className={`logo-group count-${override ? 1 : clubs.length}`}>
      {override ? (
        <ClubLogo name={club} logos={logos} override={override} />
      ) : (
        clubs.map((c, i) => <ClubLogo key={i} name={c} logos={logos} />)
      )}
    </div>
  );
}
function EventCard({
  event,
  logos,
  onSelect,
  onMove,
  dragged,
}: {
  event: EventItem;
  logos: Record<string, string>;
  onSelect: (id: string) => void;
  onMove: (source: string, target: string) => void;
  dragged: React.MutableRefObject<string | null>;
}) {
  const c = getCampus(event.campus);
  return (
    <article
      className="design-card interactive"
      data-event-id={event.id}
      draggable
      onDragStart={e => {
        if(e.currentTarget.closest(".zoom-stage")){e.preventDefault();return;}
        dragged.current = event.id;
      }}
      onDragEnd={() => {
        dragged.current = null;
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (dragged.current) onMove(dragged.current, event.id);
      }}
      onClick={e=>{if(!e.currentTarget.closest(".zoom-stage")||!window.__sksDragged)onSelect(event.id);}}
      onDoubleClick={()=>onSelect(event.id)}
      title="Düzenlemek için tıklayın; sıralamak için sürükleyin"
      style={{ "--c": c.color, "--soft": c.soft } as React.CSSProperties}
    >
      <div className="card-head">
        <LogoGroup
          club={event.club}
          logos={logos}
          override={event.logoOverride}
        />
        <span>{event.club.toLocaleUpperCase("tr-TR")}</span>
      </div>
      <h3>{event.title}</h3>
      <div className="time">{event.time}{event.endDate&&event.endDate!==event.date?` · Bitiş: ${new Date(event.endDate+"T12:00:00").toLocaleDateString("tr-TR")}`:""}</div>
      <div className="meta">
        <span>
          <MapPin /> {event.location || "Mekân bilgisi eklenecek"}
        </span>
        <span className="campus">{campusLabel(event.campus)}</span>
      </div>
    </article>
  );
}
function EventDesign({
  grouped,
  logos,
  format,
  onSelect,
  onMove,
  dragged,
}: {
  grouped: [string, EventItem[]][];
  logos: Record<string, string>;
  format: Format;
  onSelect: (id: string) => void;
  onMove: (source: string, target: string) => void;
  dragged: React.MutableRefObject<string | null>;
}) {
  return (
    <div className="design-body">
      {grouped.map(([date, items], dayIndex) => {
        const rows: EventItem[][] = [];
        if (format === "mail") {
          for (let i = 0; i < items.length; i += 4)
            rows.push(items.slice(i, i + 4));
        } else rows.push(items);
        const dayColor =
          format === "mail"
            ? SUMMARY_COLORS[dayIndex % SUMMARY_COLORS.length].color
            : getCampus(items[0]?.campus || "").color;
        return (
          <section className="day-section" key={date}>
            <div className="day-label" style={{ background: dayColor }}>
              {format === "mail" ? (
                <>
                  <b>{displayDate(date)}</b>
                  <span>{dayName(date)}</span>
                </>
              ) : (
                <b>{dayName(date)}</b>
              )}
            </div>
            {rows.map((row, i) => (
              <div
                className={`cards-grid ${format === "mail" ? "mail-row " : ""}cols-${row.length}`}
                key={i}
              >
                {row.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    logos={logos}
                    onSelect={onSelect}
                    onMove={onMove}
                    dragged={dragged}
                  />
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
function SummaryGrid({
  events,
  logos,
}: {
  events: EventItem[];
  logos: Record<string, string>;
}) {
  const anchor =
      events
        .map((x) => x.date)
        .filter(Boolean)
        .sort()[0] || "2026-09-21",
    monday = weekBounds(anchor).start,
    days = Array.from({ length: 7 }, (_, i) => {
      const x = new Date(`${monday}T12:00:00`);
      x.setDate(x.getDate() + i);
      return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    });
  return (
    <div className="summary-grid">
      {days.map((date, i) => {
        const es = events.filter((e) => e.date === date),
          c = SUMMARY_COLORS[i % SUMMARY_COLORS.length],
          holiday = getHoliday(date),
          allClubs=Array.from(new Map(es.flatMap(e=>e.logoOverride?[{name:e.club,override:e.logoOverride}]:splitClubs(e.club).map(name=>({name,override:undefined}))).map(c=>[normalize(c.name),c])).values()),
          clubs=allClubs.slice(0,10);
        return (
          <article
            key={date}
            className={holiday ? "holiday-day" : ""}
            style={{ "--c": c.color, "--soft": c.soft } as React.CSSProperties}
          >
            <div className="summary-date">
              <span>{shortDayName(date)}</span>
              <b>{new Date(`${date}T12:00:00`).getDate()}</b>
            </div>
            {holiday && (
              <div className="holiday-badge">
                <span>Resmî Tatil</span>
                <b>{holiday}</b>
              </div>
            )}
            <div className={`summary-logos count-${clubs.length}`}>
              {clubs.map((club, j) => (
                <ClubLogo
                  key={j}
                  name={club.name}
                  logos={logos}
                  override={club.override}
                />
              ))}
            </div>
            {allClubs.length>clubs.length&&<small>+{allClubs.length-clubs.length} kulüp · Detay sayfalarında</small>}
          </article>
        );
      })}
      <div className="summary-note">
        <img src={`${PUBLIC_BASE}/logos/skslogo.png`} alt="SKS" />
        <b>
          Öğrenci kulübü etkinliklerinin detaylarını görüntülemek için kaydırın
        </b>
        <ArrowRight aria-hidden="true" />
      </div>
    </div>
  );
}
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z";
function SocialIcon({ label, path }: { label: string; path: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
function DesignFooter() {
  return (
    <footer className="design-footer">
      <div className="footer-info">
        <span>Detaylı bilgi için:</span>
        <b>sks.uskudar.edu.tr</b>
      </div>
      <div className="footer-center">
        <img
          src={`${PUBLIC_BASE}/logos/uulogo-cropped.png`}
          alt="Üsküdar Üniversitesi"
        />
        <img src={`${PUBLIC_BASE}/logos/skslogo.png`} alt="SKS" />
        <strong>
          T.C. ÜSKÜDAR ÜNİVERSİTESİ
          <br />
          SAĞLIK, KÜLTÜR VE SPOR
          <br />
          DAİRE BAŞKANLIĞI
        </strong>
      </div>
      <div className="footer-social">
        <div>
          <SocialIcon label="Facebook" path={siFacebook.path} />
          <SocialIcon label="Instagram" path={siInstagram.path} />
          <SocialIcon label="YouTube" path={siYoutube.path} />
          <SocialIcon label="LinkedIn" path={LINKEDIN_PATH} />
          <SocialIcon label="X" path={siX.path} />
        </div>
        <span>@uskudarsks</span>
      </div>
    </footer>
  );
}

function BatchExports({
  storyPages,
  grouped,
  pages,
  events,
  logos,
  background,
  range,
  mailHeight,
}: {
  grouped: [string, EventItem[]][];
  pages: EventItem[][];storyPages:EventItem[][];
  events: EventItem[];
  logos: Record<string, string>;
  background: string;
  range: string;
  mailHeight: number;
}) {
  const batchDragged = useRef<string | null>(null),
    noop = () => {};
  const bg = background
    ? `linear-gradient(180deg,rgba(5,40,29,.82),rgba(5,26,21,.94)),url(${background})`
    : undefined;
  const pageGroups = (items: EventItem[]) =>
    Object.entries(
      items.reduce<Record<string, EventItem[]>>((a, e) => {
        (a[e.date] ??= []).push(e);
        return a;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b)) as [string, EventItem[]][];
  return (
    <div className="batch-exports" aria-hidden="true">
      <div
        className="design-canvas mail"
        data-export-name="01-mail-bulteni.png"
        data-export-width="1200"
        data-export-height={mailHeight}
        style={{ width: 1200, height: "auto", minHeight: mailHeight, backgroundImage: bg }}
      >
        <DesignHeader range={range} count={events.length} />
        <EventDesign
          grouped={grouped}
          logos={logos}
          format="mail"
          onSelect={noop}
          onMove={noop}
          dragged={batchDragged}
        />
        <DesignFooter />
      </div>
      {pages.map((items, i) => (
        <div
          key={`post-${i}`}
          className="design-canvas post"
          data-export-name={`02-post-sayfa-${i + 1}.png`}
          data-export-width="1080"
          data-export-height="1350"
          style={{ width: 1080, height: 1350, backgroundImage: bg }}
        >
          <DesignHeader
            range={items[0] ? displayDate(items[0].date) : range}
            count={items.length}
          />
          <EventDesign
            grouped={pageGroups(items)}
            logos={logos}
            format="post"
            onSelect={noop}
            onMove={noop}
            dragged={batchDragged}
          />
          <DesignFooter />
        </div>
      ))}
      {storyPages.map((items, i) => (
        <div
          key={`story-${i}`}
          className="design-canvas story"
          data-export-name={`03-story-sayfa-${i + 1}.png`}
          data-export-width="1080"
          data-export-height="1920"
          style={{ width: 1080, height: 1920, backgroundImage: bg }}
        >
          <DesignHeader
            range={items[0] ? displayDate(items[0].date) : range}
            count={items.length}
          />
          <EventDesign
            grouped={pageGroups(items)}
            logos={logos}
            format="story"
            onSelect={noop}
            onMove={noop}
            dragged={batchDragged}
          />
          <DesignFooter />
        </div>
      ))}
      <div
        className="design-canvas summary"
        data-export-name="04-haftalik-ozet.png"
        data-export-width="1080"
        data-export-height="1350"
        style={{ width: 1080, height: 1350, backgroundImage: bg }}
      >
        <DesignHeader range={range} count={events.length} />
        <SummaryGrid events={events} logos={logos} />
        <DesignFooter />
      </div>
      <div
        className="design-canvas summary summary-story"
        data-export-name="05-haftalik-ozet-story.png"
        data-export-width="1080"
        data-export-height="1920"
        style={{ width: 1080, height: 1920, backgroundImage: bg }}
      >
        <DesignHeader range={range} count={events.length} />
        <SummaryGrid events={events} logos={logos} />
        <DesignFooter />
      </div>
    </div>
  );
}
