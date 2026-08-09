# ✈️ Airport Simulator — Havalimanları için Check-in Simülatörü

Tarayıcıda çalışan, havalimanı check-in alanı tasarlayıp yolcu akışını simüle eden bir planlama ve analiz aracı.

🔗 **Canlı Demo:** [airport-sim-demo.netlify.app](https://airport-sim-demo.netlify.app/)
📦 **Kaynak Kod:** [github.com/erenozden1/Airport-Simulator](https://github.com/erenozden1/Airport-Simulator)
✉️ **İletişim:** erenozden.uk@gmail.com

---

## 📖 Proje Hakkında

Turkish Technology'deki ikinci haftamda, Ajet Dijital Çözümler Müdürlüğü'ne bağlı arge birimimle beraber Sabiha Gökçen Havaalanı'na yaptığım gözlem gezisi sonucunda iki şey dikkatimi çekti:

1. Havaalanı check-in kısmında hiçbir sistem optimal seviyede çalışmıyor ve organizasyon beklenen hızda ilerlemiyor.
2. İnsanların büyük bir kısmı self check-in kiosk'larını ve self baggage drop ünitelerini beklenen hız ve başarı oranında kullanamıyor.

Bu gözlemler ışığında, "neden tüm işlemler tek büyük bir makinede değil de birden fazla ufak makine tarafından paylaşılıyor?" sorusunu kendime sorarak bir simülasyon hazırlamaya karar verdim. Amaç; makine/işlem kombinasyonlarının ve makine konumlarının en optimal versiyonunu görmekti.

Gerçek bir terminali yeniden düzenlemek hem pahalı hem de yavaş. Airport Simulator, bu tasarım kararlarını (kaç kiosk konulacağı, bagaj bırakma ünitelerinin konumu, hangi makinelerin hangi işlemleri yapacağı, kaç görevli kontuarın açık olacağı) saniyeler içinde test etmenizi sağlar.

---

## ✨ Öne Çıkan Özellikler

- 🗺️ Izgara üzerinde alan tasarımı
- 🖥️ Farklı birim tipleri: **Kiosk (K)**, **Self Bagaj Bırakma / Bag Drop (SBD)**, **Görevlili Kontuar (C)**, **Tagomat (T)**
- 🎛️ Ayarlanabilir yolcu ve işlem parametreleri
- 🔁 Aynı düzeni birden fazla kez çalıştırıp ortalama alınan istatistiksel sonuç
- 📊 Detaylı sonuç (süre/fiyat) raporu ve birim kullanım analizi
- 🛫 Uçağa biniş animasyonu
- 🌐 Çift dilli arayüz (Türkçe / İngilizce) ve responsive tasarım

---

## 🧩 Nasıl Çalışır?

### 1. Izgara Editörü ve Birimler

Kullanıcı, simülasyon alanını genişlik/yükseklik ayarıyla oluşturur ve ana ızgaraya birim yerleştirir. Sağ taraftaki paletten birimler seçilir; sol tıkla döndürme, sağ tıkla silme gibi etkileşimler kullanılabilir.

Aynı düzen boyunca bulunan her makine, yerleşim sırasına göre indekslenir (`K1`, `K2`, `SBD1`, `C1` vb.). Bu etiketler, hangi makinenin hangi türden olduğunu ve kullanım analizinde nasıl raporlandığını gösterir.

### 2. Yolcu Parametreleri

| Parametre | Açıklama |
|---|---|
| Yolcu sayısı | Simülasyona giren toplam yolcu |
| Online check-in oranı | Check-in adımını atlayan yolcu yüzdesi |
| Online check-in + biniş kartı basma oranı | Online check-in yapıp yine de kart basanlar |
| Yalnızca kabin bagajı oranı | Bagaj kuyruğuna girmeyen yolcular |
| Self makine başarı oranları | Kiosk/SBD/Tagomat işlem başarı yüzdeleri |
| Makine–işlem uyumları | Hangi birim hangi işlemi yapabilir |

### 3. İşlem Süreleri (Process Time)

Her işlem için ayrı ortalama süre ve standart sapma tanımlanır; her işlem bir normal dağılımdan örneklenir. Dört temel işlem:

1. **Check-in** — online check-in yapmamış yolcular için
2. **Biniş kartı yazdırma** — check-in yapmamışlar ve online check-in sonrası kart basmayı seçenler için
3. **Bagaj etiketi yazdırma** — bagajı olan yolcular için
4. **Bagaj bırakma** — bagajı olan yolcular için

Bir yolcu bir birime geldiğinde, o ziyarette gerçekleştirdiği tüm işlemlerin süreleri toplanarak tek bir ziyaret süresi oluşturulur.

### 4. Neden Tek Simülasyon Değil?

Aynı düzen ve aynı giriş parametreleriyle bile, rastgele işlem süreleri ve yolcu giriş olayları nedeniyle iki çalıştırma farklı sonuç üretebilir. Bu yüzden uygulama, ana simülasyonun yanında birden çok küçük koşuyu eşzamanlı çalıştırır ve nihai sonuçları bu koşuların **ortalaması** olarak sunar.

### 5. Sonuç Raporu ve Birim Kullanımı

Simülasyon sonunda kullanıcı şu özet verileri görür:

- Ortalama toplam süre
- Toplam maliyet / yolcu başına maliyet
- Çıkış yapan yolcu sayısı
- Vazgeçen / yön bulamayan yolcu sayısı
- Her makinenin kullanım yüzdesi (tüm koşular boyunca)

### 6. Uçağa Biniş Animasyonu

Simülasyon tamamlandıktan sonra bir **"Now Boarding"** animasyonu gösterilir: yolcular iki kapıdan sırayla ilerler, kuyruklar oluşur ve uçak koltuk düzeni dolar. Bu görsel katman, hangi yolcuların "mutlu" hangilerinin "mutsuz" olduğunu da gösterir (mutluluk endeksi ayarlanabilir).

---

## ⚙️ Simülasyon Varsayımları

<details>
<summary>Tüm varsayımları görmek için tıklayın</summary>

1. Her yolcunun yürüme hızı girişte belirlenir: bir kareyi geçmek ortalama 10 saniye sürer (standart sapma: 5, en az 2).
2. Yeni yolcular her giriş kapısından bağımsız olarak, aralarında ortalama 20 saniye (standart sapma: 5) boşlukla girer; her kapıdaki ilk yolcu hemen girer.
3. Yolcular belirli bir makine türünü hedeflemez; her an eksik olan en erken adımlarını gerçekleştirebilecek en yakın/en kısa kuyruklu istasyona yönelirler ve o istasyonda yapılabilecek sonraki tüm adımları da tamamlarlar.
4. Bir ziyaretin süresi, orada yapılan işlemlerin toplamıdır. Hangi birimin hangi işlemleri yapabildiği "Birim İşlemleri" sayfasında ayarlanır (bazı kombinasyonlar kilitlidir). Her işlem en az 5 saniye sürer.
5. Kiosklar, bag drop üniteleri ve tagomatlar kullanıcı tanımlı başarı oranlarıyla çalışır; başarısız işlemde yolcu görevli kontuara gider, kontuar yoksa amaçsızca dolaşır.
6. Başarısız bir makine işlemi yolcunun tüm işlemlerini yapılmamış bırakır; kontuar görevlisi kalanları her zaman başarıyla tamamlar.
7. Görevli kontuar her şeyi tek seferde halleder; hizmet sonrası yolcu doğrudan çıkışa gider.
8. Yolcular en kısa kuyruklu istasyonu seçer; eşitlikte en yakın olan tercih edilir. Yavaş yürüyenler her zaman en yakın istasyonu seçer.
9. Görevli kontuar boşsa yolcular doğrudan oraya gider; aksi halde önce self servis makinelerini dener.
10. Bagaj bırakma noktasında check-in/biniş kartı adımları açılırsa, bagaj bırakma herkes için geçerli bir durak haline gelir.
11. Bir makine boşaldığında diğer kuyruklarda bekleyenler oraya yönelebilir (çok yavaş olanlar hariç).
12. Ulaşılabilir istasyon yoksa yolcu bekler; 10 dakika sonra sabrı tükenip vazgeçer (hata olarak sayılır).
13. Stajyerler ve görevliler yolculara doğrudan hizmet vermez, yakındaki makineleri hızlandırır:
    - **Stajyer:** çevresindeki 12 kareyi %20 hızlandırır (görevli etki alanındaysa %30).
    - **Görevli:** çevresindeki 24 kareyi %40 hızlandırır.
    - Etki alanları çakıştığında oranlar toplanmaz, yalnızca en güçlü bonus uygulanır.

</details>

---

## 🛠️ Teknik Detaylar

Proje, framework kullanmaksızın **saf JavaScript, HTML, CSS ve Canvas** ile geliştirilmiştir.

| Bileşen | Görev |
|---|---|
| **Vanilla JavaScript** | Simülasyon, veri modeli, akış kontrolü ve DOM/arayüz mantığı |
| **HTML5 Canvas** | Izgara çizimi, yolcu görünümü, birim yerleştirme, biniş animasyonu |
| **CSS** | Responsive düzen ve arayüz görünümü |
| **Çift dilli içerik** | İngilizce / Türkçe metin yapısı |
| **Çok koşulu simülasyon** | 5 çalıştırmalık ortalama analiz |

Mimaride, kullanıcı düzeni, birimler, yolcu profilleri ve simülasyon durumu tek bir uygulama kapsamında yönetilir. Simülasyon, zaman bazlı ilerleyen bir state/loop mantığıyla çalışır; yolcular en uygun birime yönelir, gerekli işlemi yapar ve checkpoint bazlı ilerler. Rastgele varyansı dengelemek için aynı düzen birden fazla koşuyla test edilir ve sonuçlar ortalanır.

---

## 💡 Öğrendiklerim

Bu proje, **"kullanıcı arayüzü + gerçekçi operasyon mantığı"** arasında sağlıklı bir denge kurmanın önemini gösterdi. Statik bir tasarım yapmak yerine, simülasyonun gerçek hayattaki düzensizlikleri yansıtması gerekiyordu. Ayrıca animasyon, rapor ve arayüz arasında bilgi odaklı bir akış kurmak, projenin en büyük tasarım zorluğu oldu.

En önemli çıkarım: her görselin yalnızca "güzel" olması değil, **karar vermeye hizmet etmesi** gerektiği. İzleyici, sonuç raporuna ilerlerken sadece "ne oldu?" değil, "neden böyle oldu?" sorusunu da takip edebilmeli.

---

## 🚧 Sırada Ne Var?

- [ ] Gerçek zamanlı veri odaklı heatmap / yoğunluk analizi
- [ ] Sonuçlar için daha zengin export / grafikleme seçenekleri
- [ ] Mobilde daha rahat dokunmatik pozisyonlama ve zoom kontrolü
- [ ] Boarding ve "İyi yolculuklar" ekranını 2D düzlemden çıkarıp daha keyifli hâle getirmek (zaman kısıtı nedeniyle tamamlanamadı) ve bu ekranlardaki grafikleri geliştirmek

---

## 🤝 Katkıda Bulunmak İster misiniz?

Geri bildirim, öneri ya da katkılarınız için:

- 🔗 Demo: https://airport-sim-demo.netlify.app/
- 📦 Repo: https://github.com/erenozden1/Airport-Simulator
- ✉️ E-posta: erenozden.uk@gmail.com
