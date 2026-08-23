# SKS Etkinlik Stüdyosu V2

Excel'den aktarılan öğrenci kulübü etkinliklerini Mail Bülteni, Instagram Post, Instagram Story ve haftalık özet tasarımlarına dönüştüren üretim sürümüdür.

**Canlı uygulama:** [pelinaybar.com/apps/event-creator-v2](https://pelinaybar.com/apps/event-creator-v2/)

## Klasörler

- `index.html` ve `_next/`: GitHub Pages için oluşturulan statik üretim çıktısı
- `logos/`: Otomatik eşleştirmede kullanılan hazır kulüp logoları
- `source/`: React, Next.js ve TypeScript kaynak kodları

## Yerel çalıştırma

```bash
cd source
npm install
npm run dev
```

## Üretim

```bash
cd source
npm run build
```

Uygulama GitHub Pages alt dizininde çalışacak şekilde `/apps/event-creator-v2` temel yoluyla derlenir.
