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

## Planlama ve takip özellikleri

- Takvim: teslim, çekim ve yayın tarihleri; görev araması ve öğrenci filtresiyle birlikte çalışır.
- Şablonlar: yönetici yeni şablon oluşturabilir, düzenleyebilir, silebilir ve şablondan görev açabilir. Başlangıçta etkinlik duyurusu, video ve bülten şablonları vardır.
- Kontrol listesi: öğrenciler kendi görevlerindeki adımları işaretleyebilir. Eksik adımlarla onaya gönderme/tamamlama veritabanında engellenir. Onay aşamasındaki listeyi yönetici düzenler.
- İş yükü: açık sorumlu görevlerin tahmini saatleri ve destek görevleri gösterilir. Bu süreler ücret veya resmi çalışma saati kaydı değildir.
- Uygulama içi bildirimler: atama, durum, teslim ve yorum değişiklikleri; yaklaşan/geciken teslim hatırlatmaları saatlik Cron işiyle oluşturulur. E-posta veya telefon bildirimi gönderilmez. Açık sayfa dakikada bir yenilenir.
- İşlem geçmişi: sunucu tarafından yazılan görev ve yorum olayları; panoda son 200 kayıt görünür. Öğrenci geçmişi yalnızca erişebildiği görevlerle sınırlıdır.
- Günlük yedek: Türkiye saatiyle 06.00'da alınan 30 günlük JSON kayıt kopyaları. Yönetici Rapor ve yedek ekranından indirebilir. Cron işleri uygulama kapalıyken de veritabanında çalışır; projenin aktif durumda olması gerekir.

Yedekler aynı veritabanındaki özel tabloda tutulur; farklı sunucuda felaket kurtarma yedeği değildir. İndirilip ayrı güvenli bir yerde tutulması önerilir. Şifreler ve Drive/OneDrive dosyalarının kendisi kopyalanmaz. İlk yedek kurulum sırasında alınmıştır.

`db/sks-schema.sql` ilk kurulum tabanıdır. Yeni özelliklerin ek şeması `supabase/migrations/` altında sürümlenir. Mevcut projede bu migration'lar uygulanmıştır; tekrar çalıştırmayın.

## Arayüz

Masaüstünde sol menü, mobilde alt menü ve Diğer menüsü kullanılır. Açılışta Bugün ekranı gelir; öğrenciler kendi bugünkü işleri, revizyonları ve yaklaşan teslimlerini görür. Görev kartları kalan süreyi, sorumlu baş harflerini, durum yazısını ve kontrol ilerlemesini gösterir. Görev detayları sağ panelde açılır.

Masaüstünde kartlar pano sütunları arasında sürüklenebilir. Öğrenciler yalnızca devam eden çalışmaya veya onay aşamasına taşıyabilir; tamamlanma ve revizyon kararları yöneticiye aittir. Revizyon isteği açıklama gerektirir, eksik kontrol adımları onay/tamamlama geçişini engeller. Mobil ve klavye kullanımında görev panelindeki durum düğmeleri aynı işi yapar.
