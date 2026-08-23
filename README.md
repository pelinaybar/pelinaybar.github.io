# Pelin Aybar — Web Projeleri

Bu depo, **pelinaybar.com** üzerinde yayınlanan web projelerini ve Üsküdar Üniversitesi Sağlık, Kültür ve Spor Daire Başkanlığı için geliştirilen araçları içerir.

## Canlı bağlantılar

| Proje | Açıklama | Bağlantı |
|---|---|---|
| Ana site | Projelerin listelendiği giriş sayfası | [pelinaybar.com](https://pelinaybar.com) |
| Etkinlik Oluşturucu V1 | İlk etkinlik tasarım aracı | [Versiyon 1'i aç](https://pelinaybar.com/apps/event-creator/) |
| SKS Etkinlik Stüdyosu V2 | Excel'den Mail, Post, Story ve haftalık özet üreten güncel sürüm | [Versiyon 2'yi aç](https://pelinaybar.com/apps/event-creator-v2/) |

## SKS Etkinlik Stüdyosu V2

2026–2027 Akademik Yılı öğrenci kulübü etkinliklerini tek bir veri kaynağından farklı iletişim formatlarına dönüştüren, tamamen tarayıcıda çalışan bir tasarım stüdyosudur.

### Öne çıkan özellikler

- SKS Etkinlik İstatistik Excel şablonundan toplu veri aktarımı
- Mail bülteni, Instagram Post, Instagram Story, haftalık özet Post ve haftalık özet Story
- Tüm formatlarda ortak ve senkronize etkinlik verisi
- Etkinlik kartına tıklayarak tarih, saat, kulüp, etkinlik, mekân ve yerleşke düzenleme
- Aynı gün içindeki etkinlikleri saate göre otomatik sıralama
- Sürükle–bırak ile manuel kart sıralama
- Yerleşkeye göre otomatik kurumsal renklendirme
- Kulüp adına göre otomatik logo eşleştirme
- Ortak etkinliklerde iki veya üç logoyu orantılı yerleştirme
- Kulüp bazında tek tek logo değiştirme ve toplu logo klasörü yükleme
- Resmî tatilleri haftalık özette gösterme
- Yüksek çözünürlüklü PNG ve bütün tasarımları içeren ZIP çıktısı
- Otomatik yerel taslak kaydı ve son 25 sürüme kadar çalışma geçmişi
- Yeni Excel yüklenmeden önce mevcut çalışmayı geçmişe kaydetme
- Ekrana göre otomatik ölçeklenen canlı önizleme

### Çıktı formatları

| Format | Boyut | İçerik |
|---|---:|---|
| Mail Bülteni | 1200 px × otomatik yükseklik | Haftanın bütün etkinlikleri, günde dört kartlık satırlar |
| Instagram Post | 1080 × 1350 px | Gün bazlı, sayfa başına en fazla dört etkinlik |
| Instagram Story | 1080 × 1920 px | Gün bazlı dikey etkinlik akışı |
| Haftalık Özet Post | 1080 × 1350 px | Pazartesi–Pazar günleri ve kulüp logoları |
| Haftalık Özet Story | 1080 × 1920 px | Haftalık özetin Story uyarlaması |

### Kullanım

1. [SKS Etkinlik Stüdyosu V2](https://pelinaybar.com/apps/event-creator-v2/) sayfasını açın.
2. SKS Etkinlik İstatistik Excel dosyasını yükleyin.
3. Gerekirse arka planı ve kulüp logolarını değiştirin.
4. Kartlara tıklayarak etkinlikleri düzenleyin.
5. Mail, Post, Story veya haftalık özet formatını seçin.
6. Tek tasarımı PNG olarak ya da bütün çıktıları ZIP olarak indirin.

## Veri ve gizlilik

- Excel verileri işlenmek üzere bir sunucuya gönderilmez; tarayıcı içinde okunur.
- Çalışma taslakları ve sürüm geçmişi aynı cihazdaki tarayıcı depolamasında tutulur.
- Site verileri temizlenirse yerel taslak ve geçmiş kayıtları da silinir.
- Yeni Excel yüklemek mevcut çalışma verisini yeniler; önceki sürüm geçmişte korunur.
- Ana sayfa, V1 ve V2 doğrudan bağlantıları aynı sekme tabanlı görsel erişim ekranını kullanır. Bu katman kullanıcı deneyimi amaçlıdır; sunucu taraflı kimlik doğrulama değildir.

## Proje yapısı

```text
.
├── index.html                    # Ana site
├── assets/                       # Ana site varlıkları
└── apps/
    ├── event-creator/            # Versiyon 1
    └── event-creator-v2/
        ├── index.html            # GitHub Pages üretim çıktısı
        ├── logos/                # Hazır kulüp logoları
        └── source/               # V2 kaynak kodu
```

## Yerel geliştirme

```bash
cd apps/event-creator-v2/source
npm install
npm run dev
```

Üretim çıktısı:

```bash
npm run build
```

## Teknolojiler

- Next.js
- React
- TypeScript
- SheetJS
- html-to-image
- JSZip
- GitHub Pages

## Yayınlama

Depo `main` dalına gönderildiğinde GitHub Pages üzerinden yayınlanır. `CNAME` dosyası özel alan adı olan **pelinaybar.com** bağlantısını korur.

---

Geliştiren: **Pelin Aybar**
