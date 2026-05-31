import dayjs from 'dayjs';

export const PRODUCTS = [
  { id: 'wallvex',  name: 'WallVex Pro', short: 'WVP', color: '#C9922A' },
  { id: 'chromvex', name: 'Chromvex',    short: 'CVX', color: '#0B1F3A' },
  { id: 'primvex',  name: 'Primvex',     short: 'PVX', color: '#E8B84B' },
];

export const MONTHLY_SALES = [
  { month: 'Dec', wallvex: 148000, chromvex: 92000,  primvex: 64000 },
  { month: 'Jan', wallvex: 162000, chromvex: 104000, primvex: 71000 },
  { month: 'Feb', wallvex: 175000, chromvex: 118000, primvex: 80000 },
  { month: 'Mar', wallvex: 198000, chromvex: 130000, primvex: 88000 },
  { month: 'Apr', wallvex: 186000, chromvex: 122000, primvex: 82000 },
  { month: 'May', wallvex: 214000, chromvex: 138500, primvex: 96200 },
];

export const TARGET = {
  revenue:  500000,
  achieved: 328700,
  products: [
    { id: 'wallvex',  name: 'WallVex Pro', target: 250000, achieved: 214000, color: '#C9922A' },
    { id: 'chromvex', name: 'Chromvex',    target: 150000, achieved: 138500, color: '#0B1F3A' },
    { id: 'primvex',  name: 'Primvex',     target: 100000, achieved: 96200,  color: '#E8B84B' },
  ],
};

export const RECENT_ORDERS = [
  { id: 'ORD-001', dealer: 'Sharma Paints',  location: 'Satara',   product: 'WallVex Pro', qty: 20, amount: 18400, status: 'pending',    date: dayjs().format('DD MMM') },
  { id: 'ORD-002', dealer: 'Kadam Traders',  location: 'Pune',     product: 'Chromvex',    qty: 15, amount: 12750, status: 'delivered',  date: dayjs().subtract(1,'day').format('DD MMM') },
  { id: 'ORD-003', dealer: 'More Hardware',  location: 'Sangli',   product: 'Primvex',     qty: 30, amount: 22500, status: 'processing', date: dayjs().subtract(1,'day').format('DD MMM') },
  { id: 'ORD-004', dealer: 'Patil Depot',    location: 'Kolhapur', product: 'WallVex Pro', qty: 10, amount: 9200,  status: 'pending',    date: dayjs().subtract(2,'day').format('DD MMM') },
  { id: 'ORD-005', dealer: 'Raje Paints',    location: 'Satara',   product: 'Chromvex',    qty: 25, amount: 21250, status: 'delivered',  date: dayjs().subtract(2,'day').format('DD MMM') },
];

export const DUES = [
  { id: 'D1', dealer: 'Kadam Traders',  location: 'Pune',     amount: 52400, days: 45, initials: 'KT' },
  { id: 'D2', dealer: 'Patil Depot',    location: 'Kolhapur', amount: 41600, days: 62, initials: 'PD' },
  { id: 'D3', dealer: 'Sharma Paints',  location: 'Satara',   amount: 38000, days: 28, initials: 'SP' },
  { id: 'D4', dealer: 'More Hardware',  location: 'Sangli',   amount: 8200,  days: 12, initials: 'MH' },
];

export const KPI = {
  todaySales:         48200,
  todayVsYest:        12,
  pendingOrders:      7,
  dueTodayOrders:     3,
  outstanding:        140200,
  outstandingDealers: 4,
  activeDealers:      23,
  newDealers:         2,
};