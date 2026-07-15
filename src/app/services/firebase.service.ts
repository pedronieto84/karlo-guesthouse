import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../environments/environment';

// Live Firebase imports
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, Auth, User } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, Firestore, query, orderBy } from 'firebase/firestore';

export interface Room {
  id: string;
  number: number;
  name: string;
  type: 'suite' | 'double' | 'cabin';
  price: number;
  status: 'available' | 'maintenance';
}

export interface Booking {
  id: string;
  roomId: string;
  roomNumber?: number;
  roomName?: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;

  public readonly currentUser = signal<{ email: string | null; displayName: string | null } | null>(null);
  public readonly useLiveFirebase = signal<boolean>(false);

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    // Check if valid API Key is provided
    if (environment.firebaseConfig.apiKey && environment.firebaseConfig.apiKey.length > 5) {
      try {
        this.app = initializeApp(environment.firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.useLiveFirebase.set(true);
        console.log('Firebase initialized successfully in live mode.');
        
        // Listen to Auth State changes
        this.auth.onAuthStateChanged((user: User | null) => {
          if (user) {
            this.currentUser.set({
              email: user.email,
              displayName: user.displayName
            });
          } else {
            this.currentUser.set(null);
          }
        });
      } catch (err) {
        console.error('Failed to initialize Firebase, falling back to local mock mode:', err);
        this.useLiveFirebase.set(false);
        this.setupMockSession();
      }
    } else {
      console.log('Firebase API key missing. Running in local mock mode (data persisted in LocalStorage).');
      this.useLiveFirebase.set(false);
      this.setupMockSession();
    }
  }

  // Local Storage Session logic
  private setupMockSession() {
    if (typeof window !== 'undefined') {
      const mockUser = localStorage.getItem('mock_admin_user');
      if (mockUser) {
        this.currentUser.set(JSON.parse(mockUser));
      }
    }
  }

  // Authenticate with Google
  public async loginWithGoogle(): Promise<boolean> {
    if (this.useLiveFirebase() && this.auth) {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(this.auth, provider);
        const user = result.user;
        if (user.email === 'pedro.nieto.sanchez@gmail.com') {
          this.currentUser.set({
            email: user.email,
            displayName: user.displayName
          });
          return true;
        } else {
          // Reject other emails
          await signOut(this.auth);
          this.currentUser.set(null);
          throw new Error('Access denied. Only pedro.nieto.sanchez@gmail.com is authorized.');
        }
      } catch (err: any) {
        console.error('Firebase Auth Error:', err);
        throw err;
      }
    } else {
      // Mock Login
      const email = prompt('Introduce el correo electrónico del administrador:', 'pedro.nieto.sanchez@gmail.com');
      if (email === 'pedro.nieto.sanchez@gmail.com') {
        const userSession = { email, displayName: 'Pedro Nieto Sánchez (Local)' };
        if (typeof window !== 'undefined') {
          localStorage.setItem('mock_admin_user', JSON.stringify(userSession));
        }
        this.currentUser.set(userSession);
        return true;
      } else {
        throw new Error('Correo electrónico incorrecto. Acceso denegado.');
      }
    }
  }

  // Logout
  public async logout(): Promise<void> {
    if (this.useLiveFirebase() && this.auth) {
      await signOut(this.auth);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mock_admin_user');
      }
    }
    this.currentUser.set(null);
  }

  // Get all Rooms
  public async getRooms(): Promise<Room[]> {
    if (this.useLiveFirebase() && this.db) {
      try {
        const roomsCol = collection(this.db, 'rooms');
        const snapshot = await getDocs(roomsCol);
        let rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Room);
        
        if (rooms.length === 0) {
          rooms = await this.seedDefaultRooms();
        }
        return rooms.sort((a, b) => a.number - b.number);
      } catch (err) {
        console.error('Error fetching rooms from Firestore, returning mock data:', err);
        return this.getMockRooms();
      }
    } else {
      return this.getMockRooms();
    }
  }

  // Seed default 30 rooms
  private async seedDefaultRooms(): Promise<Room[]> {
    const rooms: Room[] = [];
    const types: ('suite' | 'double' | 'cabin')[] = ['suite', 'double', 'cabin'];
    const names = {
      suite: 'Suite Familiar con Vistas',
      double: 'Habitación Doble Acogedora',
      cabin: 'Cabaña de Montaña Ecológica'
    };
    const prices = {
      suite: 120,
      double: 60,
      cabin: 80
    };

    for (let i = 1; i <= 30; i++) {
      // Rotate types
      const type = types[(i - 1) % 3];
      const room: Room = {
        id: `room_${i}`,
        number: i,
        name: `${names[type]} #${i}`,
        type: type,
        price: prices[type],
        status: 'available'
      };
      
      if (this.useLiveFirebase() && this.db) {
        await setDoc(doc(this.db, 'rooms', room.id), room);
      }
      rooms.push(room);
    }
    return rooms;
  }

  // Get Mock Rooms from Local Storage or create them
  private getMockRooms(): Room[] {
    if (typeof window === 'undefined') return [];
    
    const localRooms = localStorage.getItem('guesthouse_rooms');
    if (localRooms) {
      return JSON.parse(localRooms);
    }
    
    // Seed locally
    const rooms: Room[] = [];
    const types: ('suite' | 'double' | 'cabin')[] = ['suite', 'double', 'cabin'];
    const names = {
      suite: 'Suite Familiar con Vistas',
      double: 'Habitación Doble Acogedora',
      cabin: 'Cabaña de Montaña Ecológica'
    };
    const prices = {
      suite: 120,
      double: 60,
      cabin: 80
    };

    for (let i = 1; i <= 30; i++) {
      const type = types[(i - 1) % 3];
      rooms.push({
        id: `room_${i}`,
        number: i,
        name: `${names[type]} #${i}`,
        type: type,
        price: prices[type],
        status: 'available'
      });
    }
    
    localStorage.setItem('guesthouse_rooms', JSON.stringify(rooms));
    return rooms;
  }

  // Update a single Room
  public async updateRoom(room: Room): Promise<void> {
    if (this.useLiveFirebase() && this.db) {
      const roomRef = doc(this.db, 'rooms', room.id);
      await updateDoc(roomRef, {
        name: room.name,
        type: room.type,
        price: room.price,
        status: room.status
      });
    } else {
      const rooms = this.getMockRooms();
      const idx = rooms.findIndex(r => r.id === room.id);
      if (idx !== -1) {
        rooms[idx] = room;
        localStorage.setItem('guesthouse_rooms', JSON.stringify(rooms));
      }
    }
  }

  // Get all Bookings
  public async getBookings(): Promise<Booking[]> {
    if (this.useLiveFirebase() && this.db) {
      try {
        const bookingsCol = collection(this.db, 'bookings');
        const snapshot = await getDocs(bookingsCol);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Booking)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        console.error('Error fetching bookings from Firestore:', err);
        return this.getMockBookings();
      }
    } else {
      return this.getMockBookings();
    }
  }

  private getMockBookings(): Booking[] {
    if (typeof window === 'undefined') return [];
    const localBookings = localStorage.getItem('guesthouse_bookings');
    return localBookings ? JSON.parse(localBookings) : [];
  }

  // Add a new Booking
  public async addBooking(booking: Omit<Booking, 'id'>): Promise<Booking> {
    const id = 'booking_' + Math.random().toString(36).substring(2, 9);
    const newBooking: Booking = {
      id,
      ...booking,
      createdAt: new Date().toISOString()
    };

    if (this.useLiveFirebase() && this.db) {
      await setDoc(doc(this.db, 'bookings', id), newBooking);
    } else {
      const bookings = this.getMockBookings();
      bookings.unshift(newBooking);
      localStorage.setItem('guesthouse_bookings', JSON.stringify(bookings));
    }
    return newBooking;
  }

  // Update Booking Status
  public async updateBookingStatus(bookingId: string, status: 'pending' | 'confirmed' | 'cancelled'): Promise<void> {
    if (this.useLiveFirebase() && this.db) {
      const bookingRef = doc(this.db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status });
    } else {
      const bookings = this.getMockBookings();
      const idx = bookings.findIndex(b => b.id === bookingId);
      if (idx !== -1) {
        bookings[idx].status = status;
        localStorage.setItem('guesthouse_bookings', JSON.stringify(bookings));
      }
    }
  }

  // Delete Booking
  public async deleteBooking(bookingId: string): Promise<void> {
    if (this.useLiveFirebase() && this.db) {
      const bookingRef = doc(this.db, 'bookings', bookingId);
      await deleteDoc(bookingRef);
    } else {
      const bookings = this.getMockBookings();
      const filtered = bookings.filter(b => b.id !== bookingId);
      localStorage.setItem('guesthouse_bookings', JSON.stringify(filtered));
    }
  }
}
