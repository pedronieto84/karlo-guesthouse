import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  // Available languages
  public readonly languages = [
    { code: 'ka', name: 'ლაშიჭალა (GE)' },
    { code: 'en', name: 'English (EN)' },
    { code: 'es', name: 'Español (ES)' },
    { code: 'ru', name: 'Русский (RU)' },
    { code: 'tr', name: 'Türkçe (TR)' },
    { code: 'fr', name: 'Français (FR)' },
    { code: 'de', name: 'Deutsch (DE)' }
  ];

  // Current language state signal
  private currentLangSignal = signal<string>('es');
  public readonly currentLang = this.currentLangSignal.asReadonly();

  // Translations dictionary state signal
  private translationsSignal = signal<Record<string, any>>({});
  public readonly translations = this.translationsSignal.asReadonly();

  // Check if translations are loaded
  private loadedSignal = signal<boolean>(false);
  public readonly loaded = this.loadedSignal.asReadonly();

  constructor() {
    // Determine initial language (browser language fallback if supported)
    let initialLang = 'es';
    if (typeof window !== 'undefined' && window.navigator) {
      const browserLang = window.navigator.language.split('-')[0];
      if (this.languages.some(l => l.code === browserLang)) {
        initialLang = browserLang;
      }
    }
    this.setLanguage(initialLang);
  }

  // Load language dictionary from public/i18n/
  public async setLanguage(lang: string): Promise<void> {
    if (!this.languages.some(l => l.code === lang)) {
      lang = 'en'; // fallback
    }

    try {
      this.currentLangSignal.set(lang);
      this.loadedSignal.set(false);
      
      const response = await fetch(`/i18n/${lang}.json?v=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`Could not load translations for language ${lang}`);
      }
      
      const data = await response.json();
      this.translationsSignal.set(data);
      this.loadedSignal.set(true);
      
      // Update HTML lang attribute
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback: embed brief default translations in case of network issue
      this.translationsSignal.set(this.getFallbackTranslations(lang));
      this.loadedSignal.set(true);
    }
  }

  // Translation helper function
  public t(path: string): string {
    const keys = path.split('.');
    let current = this.translationsSignal();
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return path; // fallback returns the key itself
      }
    }
    
    return typeof current === 'string' ? current : path;
  }

  // Simple fallbacks if fetch fails
  private getFallbackTranslations(lang: string): Record<string, any> {
    const fallbacks: Record<string, Record<string, any>> = {
      es: {
        navbar: { home: 'Inicio', about: 'El Lugar', springs: 'Manantiales', rooms: 'Habitaciones', calendar: 'Reserva', contact: 'Contacto' },
        hero: { title: 'Karlo Guesthouse Lashichala', subtitle: 'Desconexión en el Cáucaso' }
      },
      en: {
        navbar: { home: 'Home', about: 'The Place', springs: 'Springs', rooms: 'Rooms', calendar: 'Booking', contact: 'Contact' },
        hero: { title: 'Karlo Guesthouse Lashichala', subtitle: 'Disconnect in the Caucasus' }
      }
    };
    return fallbacks[lang] || fallbacks['en'];
  }
}
