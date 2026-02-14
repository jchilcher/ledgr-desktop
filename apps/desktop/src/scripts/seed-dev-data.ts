/**
 * Dev Seed Script — Populate Ledgr with comprehensive test data.
 *
 * Usage:
 *   npm run seed -w @ledgr/desktop               # seed using default DB path
 *   npm run seed -w @ledgr/desktop -- --force     # wipe DB and re-seed
 *   npm run seed -w @ledgr/desktop -- --db /path  # use custom DB path
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { BudgetDatabase } from '../main/database';

// ── CLI flags ───────────────────────────────────────────────

const args = process.argv.slice(2);
const forceFlag = args.includes('--force');
const dbFlagIdx = args.indexOf('--db');
const customDbPath = dbFlagIdx !== -1 ? args[dbFlagIdx + 1] : null;

// ── Helpers ─────────────────────────────────────────────────

function getDbPath(): string {
  if (customDbPath) return customDbPath;

  const home = os.homedir();
  const p = process.platform;

  let configDir: string;
  if (p === 'linux') {
    configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  } else if (p === 'darwin') {
    configDir = path.join(home, 'Library', 'Application Support');
  } else {
    // win32 (including WSL mounting)
    configDir = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  }

  // Electron resolves @ledgr/desktop as two directory segments
  return path.join(configDir, '@ledgr', 'desktop', 'ledgr.db');
}

/** Create a Date for year/month/day (month is 1-based). */
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/** Convert dollars to cents (integer). */
function cents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Random integer in [min, max]. */
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

/** Random day within a given month. */
function randomDay(year: number, month: number): Date {
  const maxDay = new Date(year, month, 0).getDate(); // last day of month
  return d(year, month, rand(1, maxDay));
}

// ── Seed: Users ─────────────────────────────────────────────

function seedUsers(db: BudgetDatabase) {
  console.log('  Users...');
  const me = db.getDefaultUser();
  const alex = db.createUser('Alex', '#8B5CF6');
  return { me, alex };
}

// ── Seed: Accounts ──────────────────────────────────────────

interface AccountMap {
  mainChecking: string;
  hySavings: string;
  platCard: string;
  alexChecking: string;
  jointEmergency: string;
  alexVisa: string;
}

function seedAccounts(
  db: BudgetDatabase,
  users: { me: { id: string }; alex: { id: string } },
): AccountMap {
  console.log('  Accounts...');

  const mainChecking = db.createAccount({
    name: 'Main Checking',
    type: 'checking',
    institution: 'Chase',
    balance: cents(4250),
    ownership: 'mine',
    ownerId: users.me.id,
  });

  const hySavings = db.createAccount({
    name: 'High-Yield Savings',
    type: 'savings',
    institution: 'Ally',
    balance: cents(12500),
    ownership: 'mine',
    ownerId: users.me.id,
  });

  const platCard = db.createAccount({
    name: 'Platinum Card',
    type: 'credit',
    institution: 'Amex',
    balance: cents(-1875),
    ownership: 'mine',
    ownerId: users.me.id,
  });

  const alexChecking = db.createAccount({
    name: "Alex's Checking",
    type: 'checking',
    institution: 'Wells Fargo',
    balance: cents(3100),
    ownership: 'partner',
    ownerId: users.alex.id,
  });

  const jointEmergency = db.createAccount({
    name: 'Joint Emergency',
    type: 'savings',
    institution: 'Marcus',
    balance: cents(25000),
    ownership: 'shared',
    ownerId: null,
  });

  const alexVisa = db.createAccount({
    name: "Alex's Visa",
    type: 'credit',
    institution: 'Capital One',
    balance: cents(-650),
    ownership: 'partner',
    ownerId: users.alex.id,
  });

  return {
    mainChecking: mainChecking.id,
    hySavings: hySavings.id,
    platCard: platCard.id,
    alexChecking: alexChecking.id,
    jointEmergency: jointEmergency.id,
    alexVisa: alexVisa.id,
  };
}

// ── Seed: Categories ────────────────────────────────────────

interface CategoryMap { [name: string]: string }

function seedCategories(db: BudgetDatabase): CategoryMap {
  console.log('  Categories...');

  // Ensure defaults exist
  db.addMissingDefaultCategories();

  const map: CategoryMap = {};
  for (const c of db.getCategories()) {
    map[c.name] = c.id;
  }

  // Create "Food & Dining" parent category
  const foodDining = db.createCategory({
    name: 'Food & Dining',
    type: 'expense',
    icon: '🍔',
    color: '#FF6D00',
    isDefault: false,
    parentId: null,
  });
  map['Food & Dining'] = foodDining.id;

  // Child categories under Food & Dining
  const mealPrep = db.createCategory({
    name: 'Meal Prep',
    type: 'expense',
    icon: '🥗',
    color: '#FF8F00',
    isDefault: false,
    parentId: foodDining.id,
  });
  map['Meal Prep'] = mealPrep.id;

  const coffeeShops = db.createCategory({
    name: 'Coffee Shops',
    type: 'expense',
    icon: '☕',
    color: '#6D4C41',
    isDefault: false,
    parentId: foodDining.id,
  });
  map['Coffee Shops'] = coffeeShops.id;

  // Child categories under Transportation
  const transportId = map['Transportation'];
  const gas = db.createCategory({
    name: 'Gas',
    type: 'expense',
    icon: '⛽',
    color: '#5D4037',
    isDefault: false,
    parentId: transportId,
  });
  map['Gas'] = gas.id;

  const parking = db.createCategory({
    name: 'Parking',
    type: 'expense',
    icon: '🅿️',
    color: '#455A64',
    isDefault: false,
    parentId: transportId,
  });
  map['Parking'] = parking.id;

  // Child categories under Entertainment
  const entertainmentId = map['Entertainment'];
  const streaming = db.createCategory({
    name: 'Streaming',
    type: 'expense',
    icon: '📺',
    color: '#7B1FA2',
    isDefault: false,
    parentId: entertainmentId,
  });
  map['Streaming'] = streaming.id;

  const games = db.createCategory({
    name: 'Games',
    type: 'expense',
    icon: '🎮',
    color: '#6A1B9A',
    isDefault: false,
    parentId: entertainmentId,
  });
  map['Games'] = games.id;

  return map;
}

// ── Seed: Transactions ──────────────────────────────────────

interface NamedTransactionIds {
  charityDonation: string;
  educationCourse: string;
  udemyCourse: string;
  vacationDining: string[];
  workRelatedSupplies: string;
  shoppingImpulse: string[];
}

function seedTransactions(
  db: BudgetDatabase,
  accts: AccountMap,
  cats: CategoryMap,
): NamedTransactionIds {
  console.log('  Transactions...');

  const txIds: string[] = [];
  const namedIds: NamedTransactionIds = {
    charityDonation: '',
    educationCourse: '',
    udemyCourse: '',
    vacationDining: [],
    workRelatedSupplies: '',
    shoppingImpulse: [],
  };

  // Helper to create a transaction and return its ID
  function tx(
    accountId: string,
    date: Date,
    description: string,
    amount: number,
    categoryId: string | null,
    opts?: {
      isRecurring?: boolean;
      isInternalTransfer?: boolean;
      notes?: string;
      isHidden?: boolean;
    },
  ): string {
    const created = db.createTransaction({
      accountId,
      date,
      description,
      amount,
      categoryId,
      isRecurring: opts?.isRecurring ?? false,
      importSource: 'file',
      isInternalTransfer: opts?.isInternalTransfer ?? false,
    });
    txIds.push(created.id);

    // notes and isHidden require a separate update
    if (opts?.notes || opts?.isHidden) {
      db.updateTransaction(created.id, {
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
        ...(opts.isHidden ? { isHidden: true } : {}),
      });
    }
    return created.id;
  }

  // ── Months: Aug 2025 (8) – Feb 2026 (2 of next year)
  const months: Array<[number, number]> = [
    [2025, 8], [2025, 9], [2025, 10], [2025, 11], [2025, 12],
    [2026, 1], [2026, 2],
  ];

  // ── Income: Salary $5,000/mo on the 1st ───────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 1), 'Payroll — ACME Corp', cents(5000), cats['Salary'], {
      isRecurring: true,
    });
  }

  // ── Income: Alex's salary $4,200/mo on 15th ──────────────
  for (const [y, m] of months) {
    tx(accts.alexChecking, d(y, m, 15), 'Direct Deposit — TechStart Inc', cents(4200), cats['Salary'], {
      isRecurring: true,
    });
  }

  // ── Income: Sporadic freelance ────────────────────────────
  tx(accts.mainChecking, d(2025, 8, 20), 'Freelance — Logo Design', cents(1200), cats['Freelance'], {
    notes: 'Logo redesign for Coastal Cafe',
  });
  tx(accts.mainChecking, d(2025, 10, 5), 'Freelance — Web Project', cents(2000), cats['Freelance'], {
    notes: 'Landing page for Smith & Associates',
  });
  tx(accts.mainChecking, d(2025, 11, 18), 'Freelance — Consulting', cents(750), cats['Freelance']);
  tx(accts.mainChecking, d(2026, 1, 10), 'Freelance — App Mockups', cents(1500), cats['Freelance'], {
    notes: 'Mobile app UI mockups — 3 screens',
  });
  tx(accts.mainChecking, d(2026, 2, 3), 'Freelance — Brand Guide', cents(800), cats['Freelance']);

  // ── Rent $1,500 on 1st ────────────────────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 1), 'Rent — Maple Apartments', cents(-1500), cats['Rent'], {
      isRecurring: true,
      notes: m === 1 && y === 2026 ? 'Late fee waived — paid on 3rd' : undefined,
    });
  }

  // ── Mortgage ──────────────────────────────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 1), 'Home Mortgage — Chase Bank', cents(-1896), cats['Rent'], {
      isRecurring: true,
    });
  }

  // ── Auto Loan ─────────────────────────────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 15), 'Auto Loan — Capital One', cents(-345), cats['Transportation'], {
      isRecurring: true,
    });
  }

  // ── Student Loan ──────────────────────────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 20), 'Student Loan — Federal Direct', cents(-275), cats['Education'], {
      isRecurring: true,
    });
  }

  // ── Groceries (2-3 per month) ─────────────────────────────
  const groceryStores = ['Whole Foods', 'Trader Joe\'s', 'Costco', 'Kroger', 'Safeway', 'ALDI'];
  for (const [y, m] of months) {
    const count = rand(2, 3);
    for (let i = 0; i < count; i++) {
      tx(
        pick([accts.mainChecking, accts.platCard]),
        randomDay(y, m),
        pick(groceryStores),
        cents(-rand(80, 200)),
        cats['Groceries'],
        { notes: i === 0 && m === 9 ? 'Stocked up for the week — hosting dinner party' : undefined },
      );
    }
  }

  // ── Dining Out (3-4 per month) ────────────────────────────
  const restaurants = [
    'Chipotle', 'Olive Garden', 'Panera Bread', 'Chick-fil-A',
    'Pho House', 'Taco Bell', 'Sushi Palace', 'The Burger Joint',
    'Pizza Hut', 'Thai Express', 'Noodle Bar', 'Wendy\'s',
  ];
  for (const [y, m] of months) {
    const count = rand(3, 4);
    for (let i = 0; i < count; i++) {
      const acct = rand(1, 10) <= 7 ? accts.platCard : accts.alexVisa;
      const id = tx(acct, randomDay(y, m), pick(restaurants), cents(-rand(15, 75)), cats['Dining Out']);
      if (y === 2025 && m === 12 && i === 0) {
        namedIds.vacationDining.push(id);
      }
    }
  }

  // ── Coffee shops (4-5 per month) ──────────────────────────
  const coffees = ['Starbucks', 'Dunkin\'', 'Blue Bottle Coffee', 'Peet\'s Coffee', 'Local Brew Co'];
  for (const [y, m] of months) {
    const count = rand(4, 5);
    for (let i = 0; i < count; i++) {
      tx(
        pick([accts.platCard, accts.alexVisa]),
        randomDay(y, m),
        pick(coffees),
        cents(-rand(4, 8)),
        cats['Coffee Shops'],
      );
    }
  }

  // ── Meal prep supplies (~1 per month) ─────────────────────
  for (const [y, m] of months) {
    if (rand(1, 3) <= 2) {
      tx(accts.mainChecking, randomDay(y, m), 'Meal Prep — Container Store / Costco', cents(-rand(25, 60)), cats['Meal Prep']);
    }
  }

  // ── Gas (2 per month) ─────────────────────────────────────
  const gasStations = ['Shell', 'BP', 'Chevron', 'ExxonMobil', 'Costco Gas'];
  for (const [y, m] of months) {
    for (let i = 0; i < 2; i++) {
      tx(
        pick([accts.mainChecking, accts.alexChecking]),
        randomDay(y, m),
        pick(gasStations),
        cents(-rand(40, 65)),
        cats['Gas'],
      );
    }
  }

  // ── Parking (1 per month) ─────────────────────────────────
  for (const [y, m] of months) {
    if (rand(1, 3) <= 2) {
      tx(accts.platCard, randomDay(y, m), pick(['ParkMobile', 'City Parking Garage', 'Airport Lot B']), cents(-rand(8, 25)), cats['Parking']);
    }
  }

  // ── Utilities (~1 per month, variable) ────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 15), 'City Utilities — Electric/Water', cents(-rand(80, 200)), cats['Utilities'], {
      isRecurring: true,
      notes: m === 12 ? 'Higher than usual — holiday lights' : undefined,
    });
  }

  // ── Subscriptions ─────────────────────────────────────────
  for (const [y, m] of months) {
    tx(accts.platCard, d(y, m, 5), 'Netflix', cents(-15.99), cats['Streaming'], { isRecurring: true });
    tx(accts.platCard, d(y, m, 5), 'Spotify Premium', cents(-10.99), cats['Streaming'], { isRecurring: true });
    tx(accts.platCard, d(y, m, 1), 'Planet Fitness', cents(-45), cats['Fitness'], { isRecurring: true });
    tx(accts.platCard, d(y, m, 10), 'iCloud Storage', cents(-2.99), cats['Subscriptions'], { isRecurring: true });
    tx(accts.alexVisa, d(y, m, 8), 'Disney+', cents(-13.99), cats['Streaming'], { isRecurring: true });
  }

  // ── Internet / Phone ──────────────────────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 20), 'Xfinity Internet', cents(-80), cats['Utilities'], { isRecurring: true });
    tx(accts.mainChecking, d(y, m, 12), 'T-Mobile', cents(-85), cats['Utilities'], { isRecurring: true });
  }

  // ── Insurance (monthly on 5th) ────────────────────────────
  for (const [y, m] of months) {
    tx(accts.mainChecking, d(y, m, 5), 'GEICO — Auto Insurance', cents(-150), cats['Insurance'], { isRecurring: true });
  }

  // ── Shopping (2-3 per month) ──────────────────────────────
  const shops = ['Amazon', 'Target', 'Best Buy', 'IKEA', 'Home Depot', 'Etsy', 'Nordstrom'];
  for (const [y, m] of months) {
    const count = rand(2, 3);
    for (let i = 0; i < count; i++) {
      const desc = pick(shops);
      const id = tx(
        pick([accts.platCard, accts.alexVisa]),
        randomDay(y, m),
        desc,
        cents(-rand(25, 300)),
        cats['Shopping'],
        {
          notes: desc === 'Amazon' && rand(1, 4) === 1 ? 'Order #112-3456789 — household supplies' : undefined,
        },
      );
      if (rand(1, 5) === 1) {
        namedIds.shoppingImpulse.push(id);
      }
    }
  }

  // ── Entertainment (2-3 per month) ─────────────────────────
  const funStuff = ['AMC Theatres', 'Dave & Buster\'s', 'Bowling Alley', 'Escape Room', 'Steam Store', 'Kindle Store'];
  for (const [y, m] of months) {
    const count = rand(2, 3);
    for (let i = 0; i < count; i++) {
      const desc = pick(funStuff);
      const catName = desc === 'Steam Store' || desc === 'Kindle Store' ? 'Games' : 'Entertainment';
      const id = tx(pick([accts.platCard, accts.alexVisa]), randomDay(y, m), desc, cents(-rand(10, 80)), cats[catName]);
      if (rand(1, 4) === 1) {
        namedIds.shoppingImpulse.push(id);
      }
    }
  }

  // ── Healthcare (sporadic) ─────────────────────────────────
  tx(accts.platCard, d(2025, 9, 10), 'CVS Pharmacy', cents(-35), cats['Healthcare'], { notes: 'Prescription refill' });
  namedIds.workRelatedSupplies = tx(accts.mainChecking, d(2025, 11, 3), 'Dr. Smith — Copay', cents(-40), cats['Healthcare']);
  tx(accts.platCard, d(2026, 1, 22), 'Walgreens', cents(-22), cats['Healthcare']);

  // ── Gifts (holiday + birthday) ────────────────────────────
  tx(accts.platCard, d(2025, 12, 15), 'Amazon — Holiday Gifts', cents(-350), cats['Gifts'], {
    notes: 'Gifts for family: Mom, Dad, Sister',
  });
  tx(accts.platCard, d(2025, 12, 20), 'Etsy — Custom Frame', cents(-65), cats['Gifts']);
  tx(accts.alexVisa, d(2026, 2, 10), 'Flower Delivery — Valentine\'s', cents(-75), cats['Gifts']);

  // ── Clothing (quarterly) ──────────────────────────────────
  tx(accts.platCard, d(2025, 9, 5), 'Nordstrom — Fall Wardrobe', cents(-180), cats['Clothing']);
  tx(accts.alexVisa, d(2025, 11, 28), 'Old Navy — Black Friday', cents(-95), cats['Clothing'], {
    notes: 'Black Friday sale — 50% off everything',
  });
  tx(accts.platCard, d(2026, 1, 15), 'Uniqlo', cents(-60), cats['Clothing']);

  // ── Education ─────────────────────────────────────────────
  namedIds.udemyCourse = tx(accts.mainChecking, d(2025, 8, 25), 'Udemy — Course Bundle', cents(-49), cats['Education'], {
    notes: 'TypeScript Masterclass + React Advanced Patterns',
  });
  namedIds.educationCourse = tx(accts.mainChecking, d(2025, 12, 1), 'O\'Reilly Subscription', cents(-39), cats['Education']);

  // ── Personal Care ─────────────────────────────────────────
  tx(accts.platCard, d(2025, 9, 20), 'Great Clips', cents(-28), cats['Personal Care']);
  tx(accts.alexVisa, d(2025, 10, 15), 'Salon — Haircut & Color', cents(-120), cats['Personal Care']);
  tx(accts.platCard, d(2026, 1, 8), 'Great Clips', cents(-28), cats['Personal Care']);

  // ── Home Improvement ──────────────────────────────────────
  tx(accts.mainChecking, d(2025, 10, 10), 'Home Depot — Paint Supplies', cents(-145), cats['Home Improvement'], {
    notes: 'Bedroom repaint: 2 gal Behr Premium + rollers',
  });
  tx(accts.mainChecking, d(2026, 1, 20), 'Lowe\'s — Light Fixtures', cents(-89), cats['Home Improvement']);

  // ── Charity ───────────────────────────────────────────────
  namedIds.charityDonation = tx(accts.mainChecking, d(2025, 12, 24), 'Red Cross — Donation', cents(-100), cats['Charity'], {
    notes: 'Year-end charitable donation',
  });

  // ── Refund income ─────────────────────────────────────────
  tx(accts.platCard, d(2025, 10, 8), 'Amazon Refund — Damaged Item', cents(45), cats['Refunds']);
  tx(accts.mainChecking, d(2026, 2, 1), 'Tax Refund — 2025', cents(1250), cats['Tax Refund'], {
    notes: 'Federal tax refund for 2025',
  });

  // ── Alex's purchases on joint / partner accounts ──────────
  tx(accts.alexChecking, d(2025, 9, 12), 'PetSmart — Dog Food', cents(-55), cats['Pets']);
  tx(accts.alexChecking, d(2025, 11, 8), 'Vet — Annual Checkup', cents(-200), cats['Pets'], {
    notes: 'Max — annual vaccines and exam',
  });
  tx(accts.alexVisa, d(2026, 1, 25), 'Chewy.com — Pet Supplies', cents(-42), cats['Pets']);

  // ── Internal transfers (checking → savings) ───────────────
  tx(accts.mainChecking, d(2025, 9, 1), 'Transfer to Savings', cents(-500), cats['Transfer'], { isInternalTransfer: true });
  tx(accts.hySavings, d(2025, 9, 1), 'Transfer from Checking', cents(500), cats['Transfer'], { isInternalTransfer: true });
  tx(accts.mainChecking, d(2025, 11, 1), 'Transfer to Emergency Fund', cents(-1000), cats['Transfer'], { isInternalTransfer: true });
  tx(accts.jointEmergency, d(2025, 11, 1), 'Transfer from Checking', cents(1000), cats['Transfer'], { isInternalTransfer: true });
  tx(accts.mainChecking, d(2026, 1, 15), 'Transfer to Savings', cents(-750), cats['Transfer'], { isInternalTransfer: true });
  tx(accts.hySavings, d(2026, 1, 15), 'Transfer from Checking', cents(750), cats['Transfer'], { isInternalTransfer: true });

  // ── Uncategorized transactions (null categoryId) for review queue ──
  const uncatDescs = [
    'CHECKCARD 1234', 'POS PURCHASE — MISC', 'DEBIT CARD PURCHASE',
    'SQ *UNKNOWN VENDOR', 'PAYPAL *INST XFER', 'ZELLE PAYMENT REC\'D',
    'ACH DEBIT — UNKNOWN', 'VENMO — CASHOUT', 'WIRE TRANSFER IN',
    'PP*MARKETPLACE', 'SQ *FARMERS MKT', 'AUTOPAY — REF#8821',
    'GOOGLE *SERVICES', 'APPLE.COM/BILL', 'AMZN MKTP US',
  ];
  for (let i = 0; i < uncatDescs.length; i++) {
    const [y, m] = months[rand(0, months.length - 1)];
    tx(
      pick([accts.mainChecking, accts.platCard, accts.alexChecking]),
      randomDay(y, m),
      uncatDescs[i],
      cents(rand(1, 2) === 1 ? -rand(10, 150) : rand(20, 500)),
      null,
    );
  }

  // ── Hidden transactions ───────────────────────────────────
  tx(accts.platCard, d(2025, 10, 31), 'Duplicate — Amazon', cents(-29), cats['Shopping'], { isHidden: true });
  tx(accts.mainChecking, d(2025, 11, 5), 'Test Transaction — Ignore', cents(-1), null, { isHidden: true });
  tx(accts.platCard, d(2025, 12, 2), 'Reversed Charge — Netflix', cents(15.99), cats['Refunds'], { isHidden: true });
  tx(accts.alexVisa, d(2026, 1, 3), 'Duplicate — Target', cents(-45), cats['Shopping'], { isHidden: true });

  console.log(`    → ${txIds.length} transactions created`);
  return namedIds;
}

// ── Seed: Recurring Items & Payments ────────────────────────

interface RecurringItemIds {
  rent: string;
  electric: string;
  internet: string;
  carInsurance: string;
  phone: string;
  netflix: string;
  spotify: string;
  gym: string;
  salary: string;
  alexSalary: string;
  disney: string;
  icloud: string;
  mortgage: string;
  autoLoan: string;
  studentLoan: string;
}

function seedRecurring(
  db: BudgetDatabase,
  accts: AccountMap,
  cats: CategoryMap,
): RecurringItemIds {
  console.log('  Recurring items & payments...');

  // ── Bills ─────────────────────────────────────────────────
  const rent = db.createRecurringItem({
    description: 'Rent — Maple Apartments',
    amount: cents(-1500),
    frequency: 'monthly',
    startDate: d(2025, 1, 1),
    nextOccurrence: d(2026, 3, 1),
    accountId: accts.mainChecking,
    categoryId: cats['Rent'],
    dayOfMonth: 1,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: false,
    isActive: true,
    endDate: null,
  });

  const electric = db.createRecurringItem({
    description: 'City Utilities — Electric/Water',
    amount: cents(-120),
    frequency: 'monthly',
    startDate: d(2025, 1, 15),
    nextOccurrence: d(2026, 3, 15),
    accountId: accts.mainChecking,
    categoryId: cats['Utilities'],
    dayOfMonth: 15,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 5,
    autopay: false,
    isActive: true,
    endDate: null,
  });

  const internet = db.createRecurringItem({
    description: 'Xfinity Internet',
    amount: cents(-80),
    frequency: 'monthly',
    startDate: d(2025, 1, 20),
    nextOccurrence: d(2026, 3, 20),
    accountId: accts.mainChecking,
    categoryId: cats['Utilities'],
    dayOfMonth: 20,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const carInsurance = db.createRecurringItem({
    description: 'GEICO — Auto Insurance',
    amount: cents(-150),
    frequency: 'monthly',
    startDate: d(2025, 1, 5),
    nextOccurrence: d(2026, 3, 5),
    accountId: accts.mainChecking,
    categoryId: cats['Insurance'],
    dayOfMonth: 5,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const phone = db.createRecurringItem({
    description: 'T-Mobile',
    amount: cents(-85),
    frequency: 'monthly',
    startDate: d(2025, 1, 12),
    nextOccurrence: d(2026, 3, 12),
    accountId: accts.mainChecking,
    categoryId: cats['Utilities'],
    dayOfMonth: 12,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const mortgage = db.createRecurringItem({
    description: 'Home Mortgage — Chase Bank',
    amount: cents(-1896),
    frequency: 'monthly',
    startDate: d(2021, 6, 1),
    nextOccurrence: d(2026, 3, 1),
    accountId: accts.mainChecking,
    categoryId: cats['Rent'],
    dayOfMonth: 1,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const autoLoan = db.createRecurringItem({
    description: 'Auto Loan — Capital One',
    amount: cents(-345),
    frequency: 'monthly',
    startDate: d(2021, 9, 1),
    nextOccurrence: d(2026, 3, 15),
    accountId: accts.mainChecking,
    categoryId: cats['Transportation'],
    dayOfMonth: 15,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const studentLoan = db.createRecurringItem({
    description: 'Student Loan — Federal Direct',
    amount: cents(-275),
    frequency: 'monthly',
    startDate: d(2018, 9, 1),
    nextOccurrence: d(2026, 3, 20),
    accountId: accts.mainChecking,
    categoryId: cats['Education'],
    dayOfMonth: 20,
    dayOfWeek: null,
    itemType: 'bill',
    enableReminders: true,
    reminderDays: 3,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  // ── Subscriptions ─────────────────────────────────────────
  const netflix = db.createRecurringItem({
    description: 'Netflix',
    amount: cents(-15.99),
    frequency: 'monthly',
    startDate: d(2025, 1, 5),
    nextOccurrence: d(2026, 3, 5),
    accountId: accts.platCard,
    categoryId: cats['Streaming'],
    dayOfMonth: 5,
    dayOfWeek: null,
    itemType: 'subscription',
    enableReminders: false,
    reminderDays: null,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const spotify = db.createRecurringItem({
    description: 'Spotify Premium',
    amount: cents(-10.99),
    frequency: 'monthly',
    startDate: d(2025, 1, 5),
    nextOccurrence: d(2026, 3, 5),
    accountId: accts.platCard,
    categoryId: cats['Streaming'],
    dayOfMonth: 5,
    dayOfWeek: null,
    itemType: 'subscription',
    enableReminders: false,
    reminderDays: null,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const gym = db.createRecurringItem({
    description: 'Planet Fitness',
    amount: cents(-45),
    frequency: 'monthly',
    startDate: d(2025, 1, 1),
    nextOccurrence: d(2026, 3, 1),
    accountId: accts.platCard,
    categoryId: cats['Fitness'],
    dayOfMonth: 1,
    dayOfWeek: null,
    itemType: 'subscription',
    enableReminders: false,
    reminderDays: null,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const disney = db.createRecurringItem({
    description: 'Disney+',
    amount: cents(-13.99),
    frequency: 'monthly',
    startDate: d(2025, 1, 8),
    nextOccurrence: d(2026, 3, 8),
    accountId: accts.alexVisa,
    categoryId: cats['Streaming'],
    dayOfMonth: 8,
    dayOfWeek: null,
    itemType: 'subscription',
    enableReminders: false,
    reminderDays: null,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  const icloud = db.createRecurringItem({
    description: 'iCloud Storage',
    amount: cents(-2.99),
    frequency: 'monthly',
    startDate: d(2025, 1, 10),
    nextOccurrence: d(2026, 3, 10),
    accountId: accts.platCard,
    categoryId: cats['Subscriptions'],
    dayOfMonth: 10,
    dayOfWeek: null,
    itemType: 'subscription',
    enableReminders: false,
    reminderDays: null,
    autopay: true,
    isActive: true,
    endDate: null,
  });

  // ── Cashflow: Salaries ────────────────────────────────────
  const salary = db.createRecurringItem({
    description: 'Payroll — ACME Corp',
    amount: cents(5000),
    frequency: 'monthly',
    startDate: d(2025, 1, 1),
    nextOccurrence: d(2026, 3, 1),
    accountId: accts.mainChecking,
    categoryId: cats['Salary'],
    dayOfMonth: 1,
    dayOfWeek: null,
    itemType: 'cashflow',
    enableReminders: false,
    reminderDays: null,
    autopay: false,
    isActive: true,
    endDate: null,
  });

  const alexSalary = db.createRecurringItem({
    description: 'Direct Deposit — TechStart Inc',
    amount: cents(4200),
    frequency: 'monthly',
    startDate: d(2025, 1, 15),
    nextOccurrence: d(2026, 3, 15),
    accountId: accts.alexChecking,
    categoryId: cats['Salary'],
    dayOfMonth: 15,
    dayOfWeek: null,
    itemType: 'cashflow',
    enableReminders: false,
    reminderDays: null,
    autopay: false,
    isActive: true,
    endDate: null,
  });

  // ── Payments for Jan + Feb 2026 ───────────────────────────

  // Helper to create a pair of Jan+Feb payments
  const paymentPair = (itemId: string, amt: number, dayOfMonth: number, opts?: {
    janStatus?: string; febStatus?: string; janAmount?: number; janPaidDate?: Date | null;
    febPaidDate?: Date | null;
  }) => {
    const janStatus = opts?.janStatus ?? 'paid';
    const febStatus = opts?.febStatus ?? 'paid';
    const janAmt = opts?.janAmount ?? amt;
    const janPaid = opts?.janPaidDate !== undefined ? opts.janPaidDate : d(2026, 1, dayOfMonth);
    const febPaid = opts?.febPaidDate !== undefined ? opts.febPaidDate : d(2026, 2, dayOfMonth);

    db.createRecurringPayment({
      recurringItemId: itemId,
      dueDate: d(2026, 1, dayOfMonth),
      paidDate: janPaid,
      amount: janAmt,
      status: janStatus as 'paid' | 'pending' | 'overdue' | 'skipped',
    });
    db.createRecurringPayment({
      recurringItemId: itemId,
      dueDate: d(2026, 2, dayOfMonth),
      paidDate: febStatus === 'paid' ? febPaid : null,
      amount: amt,
      status: febStatus as 'paid' | 'pending' | 'overdue' | 'skipped',
    });
  };

  // Bills
  paymentPair(rent.id, cents(-1500), 1, { febStatus: 'pending', febPaidDate: null });
  paymentPair(electric.id, cents(-120), 15, { janAmount: cents(-145), febStatus: 'overdue', febPaidDate: null }); // amount-differs in Jan
  paymentPair(internet.id, cents(-80), 20);
  paymentPair(carInsurance.id, cents(-150), 5, { febStatus: 'skipped', febPaidDate: null });
  paymentPair(phone.id, cents(-85), 12, { febStatus: 'pending', febPaidDate: null });
  paymentPair(mortgage.id, cents(-1896), 1);
  paymentPair(autoLoan.id, cents(-345), 15);
  paymentPair(studentLoan.id, cents(-275), 20);

  // Subscriptions
  paymentPair(netflix.id, cents(-15.99), 5);
  paymentPair(spotify.id, cents(-10.99), 5, { febStatus: 'pending', febPaidDate: null });
  paymentPair(gym.id, cents(-45), 1);
  paymentPair(disney.id, cents(-13.99), 8);
  paymentPair(icloud.id, cents(-2.99), 10);

  // Salaries
  paymentPair(salary.id, cents(5000), 1);
  paymentPair(alexSalary.id, cents(4200), 15);

  console.log('    → 15 recurring items, 30 payments created');

  return {
    rent: rent.id,
    electric: electric.id,
    internet: internet.id,
    carInsurance: carInsurance.id,
    phone: phone.id,
    netflix: netflix.id,
    spotify: spotify.id,
    gym: gym.id,
    salary: salary.id,
    alexSalary: alexSalary.id,
    disney: disney.id,
    icloud: icloud.id,
    mortgage: mortgage.id,
    autoLoan: autoLoan.id,
    studentLoan: studentLoan.id,
  };
}

// ── Seed: Budget Goals ──────────────────────────────────────

function seedBudgets(db: BudgetDatabase, cats: CategoryMap) {
  console.log('  Budget goals...');

  const monthlyBudgets: Array<[string, number]> = [
    ['Groceries', 600],
    ['Dining Out', 200],
    ['Entertainment', 150],
    ['Transportation', 300],
    ['Shopping', 200],
    ['Coffee Shops', 80],
    ['Gas', 150],
    ['Utilities', 400],
    ['Personal Care', 60],
    ['Fitness', 50],
  ];
  for (const [name, dollars] of monthlyBudgets) {
    db.createBudgetGoal({
      categoryId: cats[name],
      amount: cents(dollars),
      period: 'monthly',
      rolloverEnabled: false,
      rolloverAmount: 0,
      startDate: d(2025, 8, 1),
    });
  }

  // Quarterly with rollover
  db.createBudgetGoal({
    categoryId: cats['Clothing'],
    amount: cents(300),
    period: 'monthly',
    rolloverEnabled: true,
    rolloverAmount: cents(150),
    startDate: d(2025, 8, 1),
  });

  // Yearly with rollover
  db.createBudgetGoal({
    categoryId: cats['Gifts'],
    amount: cents(600),
    period: 'yearly',
    rolloverEnabled: true,
    rolloverAmount: 0,
    startDate: d(2025, 1, 1),
  });

  // Group budget on "Food & Dining" parent
  db.createBudgetGoal({
    categoryId: cats['Food & Dining'],
    amount: cents(900),
    period: 'monthly',
    rolloverEnabled: false,
    rolloverAmount: 0,
    startDate: d(2025, 8, 1),
  });

  console.log('    → 13 budget goals created');
}

// ── Seed: Savings Goals ─────────────────────────────────────

function seedSavings(db: BudgetDatabase, accts: AccountMap) {
  console.log('  Savings goals...');

  const emergency = db.createSavingsGoal({
    name: 'Emergency Fund',
    targetAmount: cents(10000),
    currentAmount: cents(6500),
    targetDate: d(2026, 12, 31),
    accountId: accts.hySavings,
    icon: '🛟',
    color: '#2196F3',
    isActive: true,
  });
  db.createSavingsContribution({ goalId: emergency.id, amount: cents(2000), date: d(2025, 8, 1) });
  db.createSavingsContribution({ goalId: emergency.id, amount: cents(1500), date: d(2025, 10, 1) });
  db.createSavingsContribution({ goalId: emergency.id, amount: cents(1500), date: d(2025, 12, 1) });
  db.createSavingsContribution({ goalId: emergency.id, amount: cents(1500), date: d(2026, 2, 1) });

  const vacation = db.createSavingsGoal({
    name: 'Vacation — Greece 2026',
    targetAmount: cents(3000),
    currentAmount: cents(1200),
    targetDate: d(2026, 7, 1),
    accountId: null,
    icon: '✈️',
    color: '#00BCD4',
    isActive: true,
  });
  db.createSavingsContribution({ goalId: vacation.id, amount: cents(400), date: d(2025, 9, 15) });
  db.createSavingsContribution({ goalId: vacation.id, amount: cents(400), date: d(2025, 11, 15) });
  db.createSavingsContribution({ goalId: vacation.id, amount: cents(400), date: d(2026, 1, 15) });

  const laptop = db.createSavingsGoal({
    name: 'New Laptop',
    targetAmount: cents(2000),
    currentAmount: cents(1800),
    targetDate: d(2026, 4, 1),
    accountId: null,
    icon: '💻',
    color: '#607D8B',
    isActive: true,
  });
  db.createSavingsContribution({ goalId: laptop.id, amount: cents(600), date: d(2025, 8, 1) });
  db.createSavingsContribution({ goalId: laptop.id, amount: cents(600), date: d(2025, 10, 1) });
  db.createSavingsContribution({ goalId: laptop.id, amount: cents(600), date: d(2025, 12, 1) });

  console.log('    → 3 savings goals, 10 contributions created');
}

// ── Seed: Investments ───────────────────────────────────────

interface InvestmentIds {
  fidelity: string;
  voo: string;
  bnd: string;
  aapl: string;
}

function seedInvestments(db: BudgetDatabase): InvestmentIds {
  console.log('  Investments...');

  const fidelity = db.createInvestmentAccount({
    name: 'Fidelity 401(k)',
    institution: 'Fidelity',
    accountType: '401k',
  });

  // VOO: Vanguard S&P 500 ETF
  const voo = db.createHolding({
    accountId: fidelity.id,
    ticker: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    currentPrice: cents(450),
    sector: 'Index Fund',
    lastPriceUpdate: d(2026, 2, 12),
  });

  // BND: Vanguard Total Bond Market ETF
  const bnd = db.createHolding({
    accountId: fidelity.id,
    ticker: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    currentPrice: cents(72),
    sector: 'Fixed Income',
    lastPriceUpdate: d(2026, 2, 12),
  });

  // AAPL: Apple Inc.
  const aapl = db.createHolding({
    accountId: fidelity.id,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: cents(175),
    sector: 'Technology',
    lastPriceUpdate: d(2026, 2, 12),
  });

  // Use createInvestmentTransaction to create lots + transaction history together
  // VOO: 30 shares @ $380, then 20 shares @ $420
  db.createInvestmentTransaction({
    holdingId: voo.id,
    type: 'buy',
    date: d(2024, 3, 15),
    shares: 30 * 10000,
    pricePerShare: cents(380),
    totalAmount: cents(30 * 380),
    fees: 0,
    notes: 'Initial 401k contribution',
  });
  db.createInvestmentTransaction({
    holdingId: voo.id,
    type: 'buy',
    date: d(2025, 1, 10),
    shares: 20 * 10000,
    pricePerShare: cents(420),
    totalAmount: cents(20 * 420),
    fees: 0,
  });

  // BND: 60 shares @ $70, then 40 shares @ $71
  db.createInvestmentTransaction({
    holdingId: bnd.id,
    type: 'buy',
    date: d(2024, 6, 1),
    shares: 60 * 10000,
    pricePerShare: cents(70),
    totalAmount: cents(60 * 70),
    fees: 0,
  });
  db.createInvestmentTransaction({
    holdingId: bnd.id,
    type: 'buy',
    date: d(2025, 6, 1),
    shares: 40 * 10000,
    pricePerShare: cents(71),
    totalAmount: cents(40 * 71),
    fees: 0,
  });

  // AAPL: 15 shares @ $150, then 10 shares @ $165
  db.createInvestmentTransaction({
    holdingId: aapl.id,
    type: 'buy',
    date: d(2023, 11, 20),
    shares: 15 * 10000,
    pricePerShare: cents(150),
    totalAmount: cents(15 * 150),
    fees: 0,
    notes: 'Long-term tech holding',
  });
  db.createInvestmentTransaction({
    holdingId: aapl.id,
    type: 'buy',
    date: d(2025, 4, 15),
    shares: 10 * 10000,
    pricePerShare: cents(165),
    totalAmount: cents(10 * 165),
    fees: 0,
  });

  console.log('    → 1 investment account, 3 holdings, 6 buy transactions (with lots)');

  return { fidelity: fidelity.id, voo: voo.id, bnd: bnd.id, aapl: aapl.id };
}

// ── Seed: Net Worth (Manual Assets & Liabilities) ───────────

interface NetWorthIds {
  home: string;
  vehicle: string;
  mortgage: string;
  autoLoan: string;
  studentLoan: string;
}

function seedNetWorth(db: BudgetDatabase): NetWorthIds {
  console.log('  Net worth (manual assets & liabilities)...');

  const home = db.createManualAsset({
    name: 'Home — 42 Elm Street',
    category: 'property',
    value: cents(350000),
    liquidity: 'illiquid',
    notes: 'Zillow estimate as of Jan 2026',
    reminderFrequency: 'quarterly',
  });

  const vehicle = db.createManualAsset({
    name: '2021 Honda Accord',
    category: 'vehicle',
    value: cents(22000),
    liquidity: 'illiquid',
    notes: 'KBB fair market value',
    reminderFrequency: 'yearly',
  });

  const mortgageLiab = db.createManualLiability({
    name: 'Home Mortgage',
    type: 'mortgage',
    balance: cents(280000),
    interestRate: 0.065,
    monthlyPayment: cents(1896),
    originalAmount: cents(320000),
    startDate: d(2021, 6, 1),
    termMonths: 360,
    payoffDate: d(2051, 6, 1),
    notes: 'Fixed rate 30-year — Chase Bank',
  });

  const autoLoanLiab = db.createManualLiability({
    name: 'Auto Loan',
    type: 'auto_loan',
    balance: cents(15000),
    interestRate: 0.049,
    monthlyPayment: cents(345),
    originalAmount: cents(25000),
    startDate: d(2021, 9, 1),
    termMonths: 60,
    payoffDate: d(2026, 9, 1),
    notes: 'Capital One auto finance',
  });

  const studentLoanLiab = db.createManualLiability({
    name: 'Student Loan',
    type: 'student_loan',
    balance: cents(25000),
    interestRate: 0.055,
    monthlyPayment: cents(275),
    originalAmount: cents(40000),
    startDate: d(2018, 9, 1),
    termMonths: 120,
    payoffDate: d(2028, 9, 1),
    notes: 'Federal Direct — graduated repayment',
  });

  // Net worth snapshots (monthly, last 6 months)
  const snapshots = [
    { date: d(2025, 9, 1), bankTotal: cents(38000), investTotal: cents(33000), assetTotal: cents(372000), liabTotal: cents(325000) },
    { date: d(2025, 10, 1), bankTotal: cents(39500), investTotal: cents(34500), assetTotal: cents(372000), liabTotal: cents(323500) },
    { date: d(2025, 11, 1), bankTotal: cents(40200), investTotal: cents(33800), assetTotal: cents(372000), liabTotal: cents(322000) },
    { date: d(2025, 12, 1), bankTotal: cents(38800), investTotal: cents(35200), assetTotal: cents(372000), liabTotal: cents(321000) },
    { date: d(2026, 1, 1), bankTotal: cents(41000), investTotal: cents(36000), assetTotal: cents(372000), liabTotal: cents(320000) },
    { date: d(2026, 2, 1), bankTotal: cents(42350), investTotal: cents(37100), assetTotal: cents(372000), liabTotal: cents(319000) },
  ];

  let prevNetWorth: number | null = null;
  for (const s of snapshots) {
    const totalAssets = s.bankTotal + s.investTotal + s.assetTotal;
    const totalLiab = s.liabTotal;
    const netWorth = totalAssets - totalLiab;
    const change = prevNetWorth !== null ? netWorth - prevNetWorth : null;
    const changePct = prevNetWorth !== null && prevNetWorth !== 0
      ? ((netWorth - prevNetWorth) / Math.abs(prevNetWorth)) * 100
      : null;

    db.createNetWorthSnapshot({
      date: s.date,
      bankAccountsTotal: s.bankTotal,
      investmentAccountsTotal: s.investTotal,
      manualAssetsTotal: s.assetTotal,
      totalAssets,
      manualLiabilitiesTotal: s.liabTotal,
      totalLiabilities: totalLiab,
      netWorth,
      assetBreakdown: JSON.stringify({
        bankAccounts: s.bankTotal,
        investments: s.investTotal,
        property: cents(350000),
        vehicle: cents(22000),
      }),
      liabilityBreakdown: JSON.stringify({
        mortgage: cents(280000),
        autoLoan: cents(15000),
        studentLoan: cents(25000),
      }),
      changeFromPrevious: change,
      changePercentFromPrevious: changePct,
    });

    prevNetWorth = netWorth;
  }

  console.log('    → 2 assets, 3 liabilities, 6 snapshots created');

  return {
    home: home.id,
    vehicle: vehicle.id,
    mortgage: mortgageLiab.id,
    autoLoan: autoLoanLiab.id,
    studentLoan: studentLoanLiab.id,
  };
}

// ── Seed: Saved Reports ─────────────────────────────────────

function seedReports(db: BudgetDatabase) {
  console.log('  Saved reports...');

  const reports = [
    {
      name: 'Monthly Spending Summary',
      config: {
        chartType: 'pie',
        groupBy: 'category',
        dateRange: 'thisMonth',
        transactionType: 'expense',
        showTrend: false,
      },
    },
    {
      name: 'Income vs Expenses YTD',
      config: {
        chartType: 'bar',
        groupBy: 'month',
        dateRange: 'thisYear',
        transactionType: 'both',
        showTrend: true,
      },
    },
  ];

  db.setSetting('savedReports', JSON.stringify(reports));
  console.log('    → 2 saved reports');
}

// ── Seed: Category Rules (auto-categorization) ──────────────

function seedCategoryRules(db: BudgetDatabase, cats: CategoryMap) {
  console.log('  Category rules...');

  const rules: Array<[string, string]> = [
    ['STARBUCKS|DUNKIN|PEET|BLUE BOTTLE', 'Coffee Shops'],
    ['WHOLE FOODS|TRADER JOE|COSTCO|KROGER|SAFEWAY|ALDI', 'Groceries'],
    ['CHIPOTLE|OLIVE GARDEN|PANERA|CHICK-FIL-A|PIZZA HUT|TACO BELL', 'Dining Out'],
    ['AMAZON', 'Shopping'],
    ['SHELL|BP|CHEVRON|EXXON', 'Gas'],
    ['NETFLIX|SPOTIFY|DISNEY|HULU', 'Streaming'],
    ['PLANET FITNESS|GYM', 'Fitness'],
    ['CVS|WALGREENS|PHARMACY', 'Healthcare'],
    ['TARGET|BEST BUY|IKEA|HOME DEPOT|NORDSTROM', 'Shopping'],
    ['GEICO|STATE FARM|ALLSTATE', 'Insurance'],
  ];

  for (const [pattern, categoryName] of rules) {
    db.createCategoryRule({ pattern, categoryId: cats[categoryName], priority: 50 });
  }

  console.log(`    → ${rules.length} category rules created`);
}

// ── Seed: Tags ──────────────────────────────────────────────

function seedTags(db: BudgetDatabase, txIds: NamedTransactionIds) {
  console.log('  Tags...');

  const taxDeductible = db.createTag({ name: 'tax-deductible', color: '#4CAF50' });
  const reimbursable = db.createTag({ name: 'reimbursable', color: '#2196F3' });
  const vacation = db.createTag({ name: 'vacation', color: '#FF9800' });
  db.createTag({ name: 'joint', color: '#9C27B0' });
  const impulse = db.createTag({ name: 'impulse', color: '#F44336' });

  // Apply tags to specific transactions
  db.setTransactionTags(txIds.charityDonation, [taxDeductible.id]);
  db.setTransactionTags(txIds.educationCourse, [taxDeductible.id]);
  db.setTransactionTags(txIds.udemyCourse, [taxDeductible.id]);
  db.setTransactionTags(txIds.workRelatedSupplies, [reimbursable.id]);

  for (const id of txIds.vacationDining) {
    db.setTransactionTags(id, [vacation.id]);
  }
  for (const id of txIds.shoppingImpulse.slice(0, 5)) {
    db.setTransactionTags(id, [impulse.id]);
  }

  console.log('    → 5 tags created, applied to transactions');
}

// ── Seed: Transaction Splits ────────────────────────────────

function seedSplits(db: BudgetDatabase, accts: AccountMap, cats: CategoryMap) {
  console.log('  Transaction splits...');

  const costcoTx = db.createTransaction({
    accountId: accts.mainChecking,
    date: d(2026, 1, 25),
    description: 'Costco — Bulk Shopping',
    amount: cents(-280),
    categoryId: null,
    isRecurring: false,
    importSource: 'file',
  });
  db.createTransactionSplit({ parentTransactionId: costcoTx.id, categoryId: cats['Groceries'], amount: cents(-196), description: 'Groceries portion' });
  db.createTransactionSplit({ parentTransactionId: costcoTx.id, categoryId: cats['Shopping'], amount: cents(-84), description: 'Household supplies' });

  const targetTx = db.createTransaction({
    accountId: accts.platCard,
    date: d(2026, 2, 8),
    description: 'Target — Mixed Purchase',
    amount: cents(-175),
    categoryId: null,
    isRecurring: false,
    importSource: 'file',
  });
  db.createTransactionSplit({ parentTransactionId: targetTx.id, categoryId: cats['Clothing'], amount: cents(-80), description: 'Winter jacket' });
  db.createTransactionSplit({ parentTransactionId: targetTx.id, categoryId: cats['Home Improvement'], amount: cents(-60), description: 'Storage bins' });
  db.createTransactionSplit({ parentTransactionId: targetTx.id, categoryId: cats['Gifts'], amount: cents(-35), description: 'Birthday card & gift wrap' });

  console.log('    → 2 split transactions, 5 splits total');
}

// ── Seed: Spending Alerts ───────────────────────────────────

function seedSpendingAlerts(db: BudgetDatabase, cats: CategoryMap) {
  console.log('  Spending alerts...');

  const alerts: Array<[string, number]> = [
    ['Dining Out', 250],
    ['Shopping', 300],
    ['Entertainment', 200],
    ['Coffee Shops', 100],
    ['Gas', 200],
  ];

  for (const [categoryName, threshold] of alerts) {
    db.createSpendingAlert({
      categoryId: cats[categoryName],
      threshold: cents(threshold),
      period: 'monthly',
      isActive: true,
      lastTriggered: null,
    });
  }

  console.log(`    → ${alerts.length} spending alerts created`);
}

// ── Seed: Bill Preferences ──────────────────────────────────

function seedBillPreferences(db: BudgetDatabase, recurringIds: RecurringItemIds) {
  console.log('  Bill preferences...');

  db.upsertBillPreference({ recurringItemId: recurringIds.rent, preferredDueDay: 1, notes: 'Pay on the 1st to avoid late fee' });
  db.upsertBillPreference({ recurringItemId: recurringIds.electric, preferredDueDay: 10, notes: 'Would prefer earlier in month for cash flow' });
  db.upsertBillPreference({ recurringItemId: recurringIds.phone, preferredDueDay: 20, notes: null });

  console.log('    → 3 bill preferences created');
}

// ── Seed: Flex Budget Settings ──────────────────────────────

function seedFlexBudget(db: BudgetDatabase, cats: CategoryMap) {
  console.log('  Flex budget settings...');

  db.setSetting('budgetFlexTarget', JSON.stringify(cents(1500)));
  db.setSetting('budgetFixedCategoryIds', JSON.stringify([
    cats['Rent'],
    cats['Utilities'],
    cats['Insurance'],
    cats['Streaming'],
    cats['Fitness'],
  ]));

  console.log('    → flex target $1,500, 5 fixed categories');
}

// ── Seed: Asset/Liability Value History ─────────────────────

function seedAssetLiabilityHistory(db: BudgetDatabase, nw: NetWorthIds) {
  console.log('  Asset & liability value history...');

  // Home value: $340k → $350k
  const homeValues = [340000, 342000, 344000, 346000, 348000, 350000];
  // Vehicle: $24k → $22k
  const vehicleValues = [24000, 23600, 23200, 22800, 22400, 22000];
  // Mortgage: $285k → $280k
  const mortgageBalances = [285000, 284000, 283000, 282000, 281000, 280000];
  // Auto loan: $17k → $15k
  const autoBalances = [17000, 16600, 16200, 15800, 15400, 15000];
  // Student loan: $26.5k → $25k
  const studentBalances = [26500, 26200, 25900, 25600, 25300, 25000];

  const months = [
    d(2025, 9, 1), d(2025, 10, 1), d(2025, 11, 1),
    d(2025, 12, 1), d(2026, 1, 1), d(2026, 2, 1),
  ];

  for (let i = 0; i < 6; i++) {
    db.createAssetValueHistory({ assetId: nw.home, value: cents(homeValues[i]), date: months[i], source: 'manual' });
    db.createAssetValueHistory({ assetId: nw.vehicle, value: cents(vehicleValues[i]), date: months[i], source: 'manual' });
    db.createLiabilityValueHistory({ liabilityId: nw.mortgage, balance: cents(mortgageBalances[i]), date: months[i], paymentAmount: cents(1896) });
    db.createLiabilityValueHistory({ liabilityId: nw.autoLoan, balance: cents(autoBalances[i]), date: months[i], paymentAmount: cents(345) });
    db.createLiabilityValueHistory({ liabilityId: nw.studentLoan, balance: cents(studentBalances[i]), date: months[i], paymentAmount: cents(275) });
  }

  console.log('    → 30 asset/liability history entries');
}

// ── Seed: Category Corrections ──────────────────────────────

function seedCategoryCorrections(db: BudgetDatabase, cats: CategoryMap) {
  console.log('  Category corrections...');

  const corrections: Array<[string, string]> = [
    ['SQ *FARMERS MKT', 'Groceries'],
    ['GOOGLE *SERVICES', 'Subscriptions'],
    ['APPLE.COM/BILL', 'Subscriptions'],
    ['AMZN MKTP US', 'Shopping'],
  ];

  for (const [desc, catName] of corrections) {
    db.createCategoryCorrection({
      originalDescription: desc,
      correctedCategoryId: cats[catName],
      pattern: desc.toLowerCase(),
      confidence: 85,
      usageCount: 1,
    });
  }

  console.log(`    → ${corrections.length} category corrections`);
}


// ── Seed: App Settings ──────────────────────────────────────

function seedSettings(db: BudgetDatabase) {
  console.log('  App settings...');

  const dashboardLayout = {
    lg: [
      { i: 'balance-summary',      x: 0, y: 0,  w: 4,  h: 5,  minW: 3, minH: 3 },
      { i: 'spending',             x: 4, y: 0,  w: 4,  h: 5,  minW: 3, minH: 3 },
      { i: 'income',               x: 8, y: 0,  w: 4,  h: 5,  minW: 3, minH: 3 },
      { i: 'top-categories',       x: 0, y: 5,  w: 6,  h: 9,  minW: 4, minH: 5 },
      { i: 'savings-goals',        x: 6, y: 5,  w: 6,  h: 9,  minW: 4, minH: 5 },
      { i: 'recent-transactions',  x: 0, y: 14, w: 12, h: 11, minW: 6, minH: 6 },
      { i: 'net-worth',            x: 0, y: 25, w: 4,  h: 6,  minW: 3, minH: 4 },
      { i: 'budget-progress',      x: 4, y: 25, w: 4,  h: 6,  minW: 3, minH: 4 },
      { i: 'upcoming-bills',       x: 8, y: 25, w: 4,  h: 6,  minW: 3, minH: 4 },
    ],
  };
  db.setSetting('dashboardLayout', JSON.stringify(dashboardLayout));
  db.setSetting('dashboardWidgets', JSON.stringify([
    'balance-summary', 'spending', 'income', 'top-categories',
    'savings-goals', 'recent-transactions', 'net-worth',
    'budget-progress', 'upcoming-bills',
  ]));
  db.setSetting('budgetMode', 'category');
  db.setSetting('theme', 'light');
  db.setSetting('onboardingComplete', 'true');

  console.log('    → dashboard layout, budget mode, theme, onboarding');
}

// ── Main ────────────────────────────────────────────────────

function main() {
  const dbPath = getDbPath();
  console.log(`\nLedgr Dev Seed Script`);
  console.log(`Database: ${dbPath}`);

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }

  if (forceFlag) {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      console.log('Wiped existing database (--force)');
    }
  } else if (fs.existsSync(dbPath)) {
    const db = new BudgetDatabase(dbPath);
    const txCount = db.getTransactions().length;
    db.rawDb.close();
    if (txCount > 10) {
      console.error(`\nDatabase already has ${txCount} transactions.`);
      console.error('Use --force to wipe and re-seed.');
      process.exit(1);
    }
  }

  const db = new BudgetDatabase(dbPath);
  db.addMissingDefaultCategories();

  console.log('\nSeeding data:');

  const users = seedUsers(db);
  const accts = seedAccounts(db, users);
  const cats = seedCategories(db);
  const txIds = seedTransactions(db, accts, cats);
  const recurringIds = seedRecurring(db, accts, cats);
  seedBudgets(db, cats);
  seedSavings(db, accts);
  seedInvestments(db);
  const netWorthIds = seedNetWorth(db);
  seedReports(db);
  seedSettings(db);
  seedCategoryRules(db, cats);
  seedTags(db, txIds);
  seedSplits(db, accts, cats);
  seedSpendingAlerts(db, cats);
  seedBillPreferences(db, recurringIds);
  seedFlexBudget(db, cats);
  seedAssetLiabilityHistory(db, netWorthIds);
  seedCategoryCorrections(db, cats);

  // Final summary
  const summary = {
    users: db.getUsers().length,
    accounts: db.getAccounts().length,
    categories: db.getCategories().length,
    transactions: db.getTransactions().length,
    recurringItems: db.getRecurringItems().length,
    budgetGoals: db.getBudgetGoals().length,
    savingsGoals: db.getSavingsGoals().length,
    investmentAccounts: db.getInvestmentAccounts().length,
    holdings: db.getHoldings().length,
    manualAssets: db.getManualAssets().length,
    manualLiabilities: db.getManualLiabilities().length,
    netWorthSnapshots: db.getNetWorthSnapshots().length,
    categoryRules: db.getCategoryRules().length,
    tags: db.getTags().length,
    spendingAlerts: db.getSpendingAlerts().length,
  };

  console.log('\nDone! Summary:');
  for (const [key, val] of Object.entries(summary)) {
    console.log(`  ${key}: ${val}`);
  }

  db.rawDb.close();
  console.log('\nDatabase closed. Run `npm run dev -w @ledgr/desktop` to see the data.\n');
  process.exit(0);
}

main();
