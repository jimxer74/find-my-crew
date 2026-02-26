/**
 * Boat Management Module - Type Definitions
 */

// ============================================================================
// Equipment Types
// ============================================================================

export type EquipmentCategory =
  | 'engine'
  | 'rigging'
  | 'electrical'
  | 'navigation'
  | 'safety'
  | 'plumbing'
  | 'anchoring'
  | 'hull_deck'
  | 'electronics'
  | 'galley'
  | 'comfort'
  | 'dinghy';

export type EquipmentStatus = 'active' | 'decommissioned' | 'needs_replacement';

export interface BoatEquipment {
  id: string;
  boat_id: string;
  parent_id: string | null;
  name: string;
  category: EquipmentCategory;
  subcategory: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  year_installed: number | null;
  specs: Record<string, any>;
  notes: string | null;
  images: string[];
  status: EquipmentStatus;
  product_registry_id: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface BoatEquipmentInsert {
  boat_id: string;
  parent_id?: string | null;
  name: string;
  category: EquipmentCategory;
  subcategory?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  year_installed?: number | null;
  specs?: Record<string, any>;
  notes?: string | null;
  images?: string[];
  status?: EquipmentStatus;
  product_registry_id?: string | null;
  quantity?: number;
}

export interface BoatEquipmentUpdate {
  name?: string;
  category?: EquipmentCategory;
  subcategory?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  year_installed?: number | null;
  specs?: Record<string, any>;
  notes?: string | null;
  images?: string[];
  status?: EquipmentStatus;
  parent_id?: string | null;
  product_registry_id?: string | null;
  quantity?: number;
}

// ============================================================================
// Product Registry Types
// ============================================================================

export type ProductRegion = 'eu' | 'us' | 'uk' | 'asia' | 'global';

export interface DocumentationLink {
  title: string;
  url: string;
}

export interface SparePartsLink {
  region: ProductRegion;
  title: string;
  url: string;
}

export interface ProductRegistryEntry {
  id: string;
  category: string;
  subcategory: string | null;
  manufacturer: string;
  model: string;
  description: string | null;
  variants: string[];
  specs: Record<string, any>;
  manufacturer_url: string | null;
  documentation_links: DocumentationLink[];
  spare_parts_links: SparePartsLink[];
  is_verified: boolean;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRegistryInsert {
  category: string;
  subcategory?: string | null;
  manufacturer: string;
  model: string;
  description?: string | null;
  variants?: string[];
  specs?: Record<string, any>;
  manufacturer_url?: string | null;
  documentation_links?: DocumentationLink[];
  spare_parts_links?: SparePartsLink[];
}

/** Equipment with its children for tree views */
export interface EquipmentTreeNode extends BoatEquipment {
  children: EquipmentTreeNode[];
}

// ============================================================================
// Inventory Types
// ============================================================================

export interface BoatInventory {
  id: string;
  boat_id: string;
  equipment_id: string | null;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string | null;
  location: string | null;
  supplier: string | null;
  part_number: string | null;
  cost: number | null;
  currency: string;
  purchase_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface BoatInventoryInsert {
  boat_id: string;
  equipment_id?: string | null;
  name: string;
  category: string;
  quantity: number;
  min_quantity?: number;
  unit?: string | null;
  location?: string | null;
  supplier?: string | null;
  part_number?: string | null;
  cost?: number | null;
  currency?: string;
  purchase_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  images?: string[];
}

export interface BoatInventoryUpdate {
  equipment_id?: string | null;
  name?: string;
  category?: string;
  quantity?: number;
  min_quantity?: number;
  unit?: string | null;
  location?: string | null;
  supplier?: string | null;
  part_number?: string | null;
  cost?: number | null;
  currency?: string;
  purchase_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  images?: string[];
}

// ============================================================================
// Maintenance Types
// ============================================================================

export type MaintenanceCategory = 'routine' | 'seasonal' | 'repair' | 'inspection' | 'safety';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'skipped';

export interface RecurrenceConfig {
  type: 'time' | 'usage';
  interval_days?: number;
  engine_hours?: number;
}

export interface PartNeeded {
  inventory_id: string;
  quantity: number;
}

export interface BoatMaintenanceTask {
  id: string;
  boat_id: string;
  equipment_id: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  is_template: boolean;
  template_id: string | null;
  recurrence: RecurrenceConfig | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  instructions: string | null;
  parts_needed: PartNeeded[];
  notes: string | null;
  images_before: string[];
  images_after: string[];
  created_at: string;
  updated_at: string;
}

export interface BoatMaintenanceTaskInsert {
  boat_id: string;
  equipment_id?: string | null;
  title: string;
  description?: string | null;
  category: MaintenanceCategory;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  is_template?: boolean;
  template_id?: string | null;
  recurrence?: RecurrenceConfig | null;
  due_date?: string | null;
  assigned_to?: string | null;
  estimated_hours?: number | null;
  estimated_cost?: number | null;
  instructions?: string | null;
  parts_needed?: PartNeeded[];
  notes?: string | null;
}

export interface BoatMaintenanceTaskUpdate {
  equipment_id?: string | null;
  title?: string;
  description?: string | null;
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  recurrence?: RecurrenceConfig | null;
  due_date?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  assigned_to?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  instructions?: string | null;
  parts_needed?: PartNeeded[];
  notes?: string | null;
  images_before?: string[];
  images_after?: string[];
}

// ============================================================================
// Equipment Category Taxonomy
// ============================================================================

export interface SubcategoryInfo {
  value: string;
  label: string;
}

export interface CategoryInfo {
  value: EquipmentCategory;
  label: string;
  subcategories: SubcategoryInfo[];
}

export const EQUIPMENT_CATEGORIES: CategoryInfo[] = [
  {
    value: 'engine',
    label: 'Engine & Propulsion',
    subcategories: [
      { value: 'engine', label: 'Engine' },
      { value: 'fuel_system', label: 'Fuel System' },
      { value: 'cooling', label: 'Cooling System' },
      { value: 'gearbox', label: 'Gearbox' },
      { value: 'propeller', label: 'Propeller' },
      { value: 'alternator', label: 'Alternator' },
      { value: 'exhaust', label: 'Exhaust' },
    ],
  },
  {
    value: 'rigging',
    label: 'Rigging & Sails',
    subcategories: [
      { value: 'mast', label: 'Mast' },
      { value: 'boom', label: 'Boom' },
      { value: 'standing_rigging', label: 'Standing Rigging' },
      { value: 'running_rigging', label: 'Running Rigging' },
      { value: 'winches', label: 'Winches' },
      { value: 'sails', label: 'Sails' },
      { value: 'furlers', label: 'Furlers' },
    ],
  },
  {
    value: 'electrical',
    label: 'Electrical',
    subcategories: [
      { value: 'batteries', label: 'Batteries' },
      { value: 'solar', label: 'Solar Panels' },
      { value: 'wind_generator', label: 'Wind Generator' },
      { value: 'shore_power', label: 'Shore Power' },
      { value: 'wiring', label: 'Wiring' },
      { value: 'inverter', label: 'Inverter' },
      { value: 'charger', label: 'Charger' },
    ],
  },
  {
    value: 'navigation',
    label: 'Navigation',
    subcategories: [
      { value: 'gps', label: 'GPS' },
      { value: 'chartplotter', label: 'Chartplotter' },
      { value: 'radar', label: 'Radar' },
      { value: 'ais', label: 'AIS' },
      { value: 'compass', label: 'Compass' },
      { value: 'autopilot', label: 'Autopilot' },
      { value: 'instruments', label: 'Instruments' },
    ],
  },
  {
    value: 'safety',
    label: 'Safety',
    subcategories: [
      { value: 'life_raft', label: 'Life Raft' },
      { value: 'life_jackets', label: 'Life Jackets' },
      { value: 'epirb', label: 'EPIRB' },
      { value: 'flares', label: 'Flares' },
      { value: 'fire_extinguishers', label: 'Fire Extinguishers' },
      { value: 'jacklines', label: 'Jacklines' },
    ],
  },
  {
    value: 'plumbing',
    label: 'Plumbing',
    subcategories: [
      { value: 'freshwater', label: 'Freshwater System' },
      { value: 'watermaker', label: 'Watermaker' },
      { value: 'bilge_pumps', label: 'Bilge Pumps' },
      { value: 'heads', label: 'Heads' },
      { value: 'holding_tank', label: 'Holding Tank' },
    ],
  },
  {
    value: 'anchoring',
    label: 'Anchoring',
    subcategories: [
      { value: 'anchors', label: 'Anchors' },
      { value: 'chain', label: 'Chain' },
      { value: 'windlass', label: 'Windlass' },
    ],
  },
  {
    value: 'hull_deck',
    label: 'Hull & Deck',
    subcategories: [
      { value: 'hull', label: 'Hull' },
      { value: 'keel', label: 'Keel' },
      { value: 'rudder', label: 'Rudder' },
      { value: 'hatches', label: 'Hatches' },
      { value: 'ports', label: 'Ports' },
      { value: 'teak_deck', label: 'Teak Deck' },
    ],
  },
  {
    value: 'electronics',
    label: 'Electronics & Communication',
    subcategories: [
      { value: 'vhf_radio', label: 'VHF Radio' },
      { value: 'ssb', label: 'SSB Radio' },
      { value: 'satellite_phone', label: 'Satellite Phone' },
      { value: 'wifi', label: 'WiFi' },
    ],
  },
  {
    value: 'galley',
    label: 'Galley',
    subcategories: [
      { value: 'stove', label: 'Stove' },
      { value: 'oven', label: 'Oven' },
      { value: 'refrigeration', label: 'Refrigeration' },
      { value: 'provisions', label: 'Provisions' },
    ],
  },
  {
    value: 'comfort',
    label: 'Comfort',
    subcategories: [
      { value: 'heating', label: 'Heating' },
      { value: 'ventilation', label: 'Ventilation' },
      { value: 'lighting', label: 'Lighting' },
      { value: 'cushions', label: 'Cushions' },
    ],
  },
  {
    value: 'dinghy',
    label: 'Dinghy & Tender',
    subcategories: [
      { value: 'dinghy', label: 'Dinghy' },
      { value: 'outboard', label: 'Outboard Motor' },
      { value: 'davits', label: 'Davits' },
    ],
  },
];

/** Helper to get category label */
export function getCategoryLabel(category: EquipmentCategory): string {
  return EQUIPMENT_CATEGORIES.find(c => c.value === category)?.label ?? category;
}

/** Helper to get subcategory label */
export function getSubcategoryLabel(category: EquipmentCategory, subcategory: string): string {
  const cat = EQUIPMENT_CATEGORIES.find(c => c.value === category);
  return cat?.subcategories.find(s => s.value === subcategory)?.label ?? subcategory;
}
