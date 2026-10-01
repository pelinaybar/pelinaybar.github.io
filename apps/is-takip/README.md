# SKS Dijital Kanallar iş takibi

GitHub Pages yalnızca uygulama dosyalarını yayınlar. Görevler ve giriş izinleri Supabase'de tutulur. Kaynak koddaki publishable anahtar herkese açıktır; erişim veritabanı RLS politikalarıyla sınırlandırılır. Service-role anahtarı kullanılmaz.

## İlk kullanım

1. Supabase Authentication → URL Configuration bölümünde Site URL değerini `https://pelinaybar.com/apps/is-takip/` yapın ve aynı adresi Redirect URLs listesine ekleyin.
2. Pano sayfasında “İlk giriş · Hesap oluştur” sekmesinden veritabanında önceden tanımlanan yönetici adresiyle kendi şifrenizi oluşturun; e-postayı doğrulayın.
3. Ekip ekranında her öğrencinin giriş e-postasını kaydedin. Öğrenci aynı sayfada kendi hesabını oluşturup e-postasını doğrular.
4. Görev oluşturun. Öğrenci yalnızca sorumlusu veya destekçisi olduğu görevleri görür. Tamamlama onayı ve revizyon kararı birim sorumlusundadır.

“Rapor ve yedek” bölümündeki Excel ve JSON indirme manueldir. Dosya yüklemesi yerine Drive/OneDrive çalışma bağlantısı saklanır. Varsayılan Supabase e-posta hizmeti kısıtlıdır; ekip kaydı sırasında gönderim sınırına ulaşılırsa Authentication e-posta ayarlarında özel SMTP kurulmalıdır.

## Geliştirme

Depo kökünde `npm ci` ardından `npm run check:tracker` ve `npm run build:tracker` çalıştırın. Derlenen `app.js` dosyasını kaynaklarla birlikte commit edin. `db/sks-schema.sql` kurulum şemasıdır; kişisel veriler ve izin listesi içermez. Mevcut veritabanına gelişigüzel yeniden uygulanmamalıdır. Şema değişikliklerini Supabase migration işlemiyle uygulayın.

Kaynak `src/config.js` yalnızca proje URL'si ve publishable anahtarı içerir. Öğrenci e-postalarını veya ayrıcalıklı anahtarları kaynak dosyalara eklemeyin.

Kayıt kısıtlaması `auth.users` tablosundaki `sks_registration_allowlist` tetikleyicisiyle uygulanır. Yeni hesap ve e-posta değişikliği yalnızca aktif izin listesindeki adresler için kabul edilir. Liste, Ekip ekranından yönetilir. Bu kontrol mevcut yönetici hesabını değiştirmez.
