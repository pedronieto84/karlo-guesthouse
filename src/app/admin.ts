import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService, Room, Booking } from './services/firebase.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [NgClass, NgIf, NgFor, FormsModule, UpperCasePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  public readonly firebaseService = inject(FirebaseService);

  // Dashboard signals
  public readonly loading = signal<boolean>(false);
  public readonly errorMessage = signal<string>('');
  public readonly activeTab = signal<'bookings' | 'rooms'>('bookings');
  
  // Data lists
  public readonly rooms = signal<Room[]>([]);
  public readonly bookings = signal<Booking[]>([]);
  
  // Edit State
  public readonly editingRoom = signal<Room | null>(null);
  
  // Add Booking State
  public readonly isAddingBooking = signal<boolean>(false);
  
  // Form model (regular class property for easy two-way binding)
  public newBooking: Omit<Booking, 'id' | 'createdAt'> = {
    roomId: '',
    guestName: '',
    guestPhone: '',
    checkIn: '',
    checkOut: '',
    totalPrice: 0,
    status: 'confirmed'
  };

  ngOnInit() {
    if (this.firebaseService.currentUser()) {
      this.loadData();
    }
  }

  // Perform Authentication
  public async login() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const success = await this.firebaseService.loginWithGoogle();
      if (success) {
        await this.loadData();
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Error al iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  // Sign out
  public async logout() {
    await this.firebaseService.logout();
    this.rooms.set([]);
    this.bookings.set([]);
  }

  // Load Firestore data
  public async loadData() {
    this.loading.set(true);
    try {
      const fetchedRooms = await this.firebaseService.getRooms();
      const fetchedBookings = await this.firebaseService.getBookings();
      this.rooms.set(fetchedRooms);
      this.bookings.set(fetchedBookings);
    } catch (err: any) {
      this.errorMessage.set('Error al cargar datos de Firestore.');
    } finally {
      this.loading.set(false);
    }
  }

  // Select room to edit
  public startEditRoom(room: Room) {
    this.editingRoom.set({ ...room });
  }

  // Save room edits
  public async saveRoomEdit() {
    const room = this.editingRoom();
    if (!room) return;
    
    this.loading.set(true);
    try {
      await this.firebaseService.updateRoom(room);
      this.editingRoom.set(null);
      await this.loadData();
    } catch (err: any) {
      alert('Error al guardar la habitación: ' + err.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Update Booking Status
  public async updateBookingStatus(bookingId: string, status: 'pending' | 'confirmed' | 'cancelled') {
    this.loading.set(true);
    try {
      await this.firebaseService.updateBookingStatus(bookingId, status);
      await this.loadData();
    } catch (err: any) {
      alert('Error al actualizar la reserva: ' + err.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Delete Booking
  public async deleteBooking(bookingId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta reserva?')) return;
    
    this.loading.set(true);
    try {
      await this.firebaseService.deleteBooking(bookingId);
      await this.loadData();
    } catch (err: any) {
      alert('Error al eliminar la reserva: ' + err.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Start manual booking
  public startAddBooking() {
    this.newBooking = {
      roomId: this.rooms().length > 0 ? this.rooms()[0].id : '',
      guestName: '',
      guestPhone: '',
      checkIn: '2026-08-01',
      checkOut: '2026-08-05',
      totalPrice: 0,
      status: 'confirmed'
    };
    this.isAddingBooking.set(true);
    this.calculateNewBookingPrice();
  }

  // Recalculate price on adding booking
  public calculateNewBookingPrice() {
    const data = this.newBooking;
    const room = this.rooms().find(r => r.id === data.roomId);
    if (!room || !data.checkIn || !data.checkOut) {
      data.totalPrice = 0;
      return;
    }
    
    const start = new Date(data.checkIn);
    const end = new Date(data.checkOut);
    const diff = end.getTime() - start.getTime();
    
    if (diff > 0) {
      const nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
      data.totalPrice = nights * room.price;
    } else {
      data.totalPrice = 0;
    }
  }

  // Submit manual booking
  public async submitManualBooking() {
    const data = this.newBooking;
    const room = this.rooms().find(r => r.id === data.roomId);
    if (!room || !data.guestName || !data.checkIn || !data.checkOut) {
      alert('Por favor, rellena todos los campos.');
      return;
    }
    
    this.loading.set(true);
    try {
      await this.firebaseService.addBooking({
        ...data,
        roomNumber: room.number,
        roomName: room.name
      });
      this.isAddingBooking.set(false);
      await this.loadData();
    } catch (err: any) {
      alert('Error al crear la reserva: ' + err.message);
    } finally {
      this.loading.set(false);
    }
  }
}
