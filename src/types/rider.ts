export interface Rider {
  id: string;
  rider_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  orders_completed: number;
  earnings_today: number;
  availability_status: string;
}