import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslationService } from './services/translation.service';
import { FirebaseService, Room, Booking } from './services/firebase.service';

interface CalendarDay {
  dayNum: number;
  dateStr: string;
  isBooked: boolean;
  isPast: boolean;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NgClass],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class LandingComponent implements OnInit {
  public readonly translationService = inject(TranslationService);
  private readonly firebaseService = inject(FirebaseService);

  // UI State Signals
  public readonly mobileMenuOpen = signal<boolean>(false);
  public readonly langDropdownOpen = signal<boolean>(false);
  public readonly soundEnabled = signal<boolean>(true); // Sound active by default!
  public readonly activeSection = signal<string>('home');
  
  // Audio Element for Soundscape
  private audio: HTMLAudioElement | null = null;
  public readonly audioPlaying = signal<boolean>(false);

  // Testimonials Carousel Signal
  public readonly activeReviewIndex = signal<number>(0);
  public readonly reviewsCount = 3;

  // Booking / Calendar Signals
  public readonly selectedRoomType = signal<string>(''); // 'suite', 'double', 'cabin'
  public readonly checkInDate = signal<string>(''); // YYYY-MM-DD
  public readonly checkOutDate = signal<string>(''); // YYYY-MM-DD
  
  // Calendar Days State
  public readonly currentMonthYear = signal<string>('Agosto 2026');
  public readonly calendarDays = signal<CalendarDay[]>([]);
  
  // Loaded Database state
  private dbRooms: Room[] = [];
  private dbBookings: Booking[] = [];
  private readonly bookedDates = signal<Set<string>>(new Set());

  // Available languages
  public readonly languages = [
    { code: 'ka', name: 'ლაშიჭალა (GE)' },
    { code: 'ru', name: 'Русский (RU)' },
    { code: 'en', name: 'English (EN)' },
    { code: 'tr', name: 'Türkçe (TR)' },
    { code: 'de', name: 'Deutsch (DE)' },
    { code: 'fr', name: 'Français (FR)' },
    { code: 'es', name: 'Español (ES)' }
  ];

  // Room Rates in Lari (GEL) - Defaults that get updated by Firestore
  public readonly roomRates = signal<Record<string, number>>({
    suite: 120,
    double: 60,
    cabin: 80
  });

  // Computed: Selected room price per night
  public readonly pricePerNight = computed(() => {
    const room = this.selectedRoomType();
    return room ? this.roomRates()[room] : 0;
  });

  // Computed: Number of nights calculated from check-in and check-out
  public readonly totalNights = computed(() => {
    const start = this.checkInDate();
    const end = this.checkOutDate();
    if (!start || !end) return 0;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime <= 0) return 0;
    
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

  // Computed: Total price calculated
  public readonly totalPrice = computed(() => {
    return this.totalNights() * this.pricePerNight();
  });

  // Computed: Translation helper
  public t(key: string): string {
    return this.translationService.t(key);
  }

  ngOnInit() {
    this.generateCalendar();
    
    // Load Database asynchronously without blocking component rendering
    this.loadDatabaseData().then(() => {
      this.generateCalendar();
    });

    // Auto-initialize audio and attempt playback (handles browser Autoplay policies)
    if (typeof window !== 'undefined') {
      this.initializeAudio();
      this.attemptAutoplay();
    }
  }

  // Load Rooms and Bookings from Firestore
  private async loadDatabaseData() {
    try {
      this.dbRooms = await this.firebaseService.getRooms();
      this.dbBookings = await this.firebaseService.getBookings();

      const rates: Record<string, number> = { suite: 120, double: 60, cabin: 80 };
      
      const suiteRooms = this.dbRooms.filter(r => r.type === 'suite' && r.status === 'available');
      const doubleRooms = this.dbRooms.filter(r => r.type === 'double' && r.status === 'available');
      const cabinRooms = this.dbRooms.filter(r => r.type === 'cabin' && r.status === 'available');
      
      if (suiteRooms.length > 0) rates['suite'] = suiteRooms[0].price;
      if (doubleRooms.length > 0) rates['double'] = doubleRooms[0].price;
      if (cabinRooms.length > 0) rates['cabin'] = cabinRooms[0].price;
      
      this.roomRates.set(rates);

      const booked = new Set<string>();
      const defaults = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-22', '2026-08-23'];
      defaults.forEach(d => booked.add(d));

      this.dbBookings.forEach((b: Booking) => {
        if (b.status === 'confirmed') {
          const start = new Date(b.checkIn);
          const end = new Date(b.checkOut);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            booked.add(`${year}-${month}-${day}`);
          }
        }
      });
      
      this.bookedDates.set(booked);
    } catch (err) {
      console.warn('Error loading data from Firebase service, using defaults:', err);
    }
  }

  // Generate August 2026 Calendar Days
  private generateCalendar() {
    const days: CalendarDay[] = [];
    const totalDays = 31;
    
    for (let i = 1; i <= totalDays; i++) {
      const dayStr = i < 10 ? `0${i}` : `${i}`;
      const dateStr = `2026-08-${dayStr}`;
      
      days.push({
        dayNum: i,
        dateStr: dateStr,
        isBooked: this.bookedDates().has(dateStr),
        isPast: false
      });
    }
    
    this.calendarDays.set(days);
  }

  // Lazy Audio initialization
  private initializeAudio() {
    if (typeof window !== 'undefined' && !this.audio) {
      this.audio = new Audio('/river.mp3');
      if (this.audio) {
        this.audio.loop = true;
        this.audio.volume = 0.4;
      }
    }
  }

  // Attempt Autoplay and set fallbacks for browser gesture blocks
  private attemptAutoplay() {
    if (!this.audio) return;
    
    this.audio.play()
      .then(() => {
        this.audioPlaying.set(true);
      })
      .catch(() => {
        console.log('Autoplay blocked. Sound will play on first user interaction.');
        
        // Listen to the first document click or touch to play if sound remains enabled
        const playOnInteraction = () => {
          if (this.soundEnabled() && this.audio) {
            this.audio.play()
              .then(() => {
                this.audioPlaying.set(true);
              })
              .catch(e => console.warn('Delayed autoplay failed:', e));
          }
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('touchstart', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction);
        document.addEventListener('touchstart', playOnInteraction);
      });
  }

  // Handle day click on the calendar
  public onDayClick(day: CalendarDay) {
    if (day.isBooked) return;
    
    const clickedDate = day.dateStr;
    const start = this.checkInDate();
    const end = this.checkOutDate();
    
    if (!start || (start && end)) {
      this.checkInDate.set(clickedDate);
      this.checkOutDate.set('');
    } else {
      if (clickedDate < start) {
        this.checkInDate.set(clickedDate);
      } else {
        if (this.hasBookedDatesBetween(start, clickedDate)) {
          this.checkInDate.set(clickedDate);
        } else {
          this.checkOutDate.set(clickedDate);
        }
      }
    }
  }

  private hasBookedDatesBetween(start: string, end: string): boolean {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (this.bookedDates().has(dateStr)) {
        return true;
      }
    }
    return false;
  }

  // Helper to determine if a date is selected or part of the range
  public getDayClass(day: CalendarDay): Record<string, boolean> {
    const date = day.dateStr;
    const start = this.checkInDate();
    const end = this.checkOutDate();
    
    const isSelected = date === start || date === end;
    const isInRange = start && end && date > start && date < end;
    
    return {
      'day-booked': day.isBooked,
      'day-selected': !!isSelected,
      'day-in-range': !!isInRange,
      'day-available': !day.isBooked
    };
  }

  // Reset Calendar Selection
  public clearDates() {
    this.checkInDate.set('');
    this.checkOutDate.set('');
  }

  // Change active language
  public selectLanguage(langCode: string) {
    this.translationService.setLanguage(langCode);
    this.langDropdownOpen.set(false);
  }

  // Toggle ambient soundscape
  public toggleSound() {
    this.initializeAudio();
    if (!this.audio) return;
    
    if (this.soundEnabled()) {
      this.audio.pause();
      this.soundEnabled.set(false);
      this.audioPlaying.set(false);
    } else {
      this.soundEnabled.set(true);
      this.audio.play()
        .then(() => {
          this.audioPlaying.set(true);
        })
        .catch(err => {
          console.warn('Audio play failed:', err);
        });
    }
  }

  // WhatsApp Booking Redirection + Database saving
  public async submitBooking() {
    const start = this.checkInDate();
    const end = this.checkOutDate();
    const roomType = this.selectedRoomType();
    
    if (!start || !end || !roomType) return;
    
    const availableRoom = this.dbRooms.find(r => r.type === roomType && r.status === 'available');
    const roomId = availableRoom ? availableRoom.id : 'room_1';
    const roomNumber = availableRoom ? availableRoom.number : 1;
    
    const roomName = this.t(`rooms.${roomType}`);
    const nightsNum = this.totalNights();
    const totalCost = this.totalPrice();

    try {
      await this.firebaseService.addBooking({
        roomId: roomId,
        roomNumber: roomNumber,
        roomName: roomName,
        guestName: 'Web Guest',
        guestPhone: 'WhatsApp Link',
        checkIn: start,
        checkOut: end,
        totalPrice: totalCost,
        status: 'pending'
      });
      console.log('Booking recorded in Firestore.');
    } catch (err) {
      console.warn('Failed to save booking to Firestore, redirecting to WhatsApp:', err);
    }
    
    let message = '';
    const lang = this.translationService.currentLang();
    
    if (lang === 'es') {
      message = `Hola Karlo! Me gustaría reservar la habitación "${roomName}" del ${start} al ${end} (${nightsNum} noches). El precio total estimado es de ${totalCost} Lari. ¿Está disponible?`;
    } else if (lang === 'ka') {
      message = `გამარჯობა კარლო! მსურს დავჯავშნო ოთახი "${roomName}" ${start}-დან ${end}-მდე (${nightsNum} ღამე). სავარაუდო ფასი: ${totalCost} ლარი. თავისუფალია?`;
    } else if (lang === 'ru') {
      message = `Здравствуйте, Карло! Я хотел бы забронировать номер "${roomName}" с ${start} по ${end} (${nightsNum} ночей). Ориентировочная стоимость: ${totalCost} Лари. Есть ли свободные места?`;
    } else if (lang === 'tr') {
      message = `Merhaba Karlo! ${start} - ${end} tarihleri arasında (${nightsNum} gece) "${roomName}" odasını rezerve etmek istiyorum. Tahmini toplam tutar: ${totalCost} Lari. Müsaitlik durumunu teyit edebilir misiniz?`;
    } else if (lang === 'fr') {
      message = `Bonjour Karlo ! Je souhaite réserver la chambre "${roomName}" du ${start} au ${end} (${nightsNum} nuits). Le prix total estimé est de ${totalCost} Lari. Est-elle disponible ?`;
    } else if (lang === 'de') {
      message = `Hallo Karlo! Ich möchte das Zimmer "${roomName}" vom ${start} bis zum ${end} (${nightsNum} Nächte) buchen. Der geschätzte Gesamtpreis beträgt ${totalCost} Lari. Ist es frei?`;
    } else { // en fallback
      message = `Hello Karlo! I would like to book the "${roomName}" from ${start} to ${end} (${nightsNum} nights). Estimated total price: ${totalCost} Lari. Is it available?`;
    }
    
    const whatsappUrl = `https://wa.me/34631331132?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') {
      window.open(whatsappUrl, '_blank');
    }
  }

  // Testimonials Carousel Controls
  public setReviewIndex(index: number) {
    this.activeReviewIndex.set(index);
  }

  public nextReview() {
    this.activeReviewIndex.set((this.activeReviewIndex() + 1) % this.reviewsCount);
  }

  public prevReview() {
    this.activeReviewIndex.set((this.activeReviewIndex() - 1 + this.reviewsCount) % this.reviewsCount);
  }
}
