/**
 Generated from HarperDB schema
 Manual changes will be lost!
 > harper dev .
 */
export interface AgentAction {
	id: string;
	action?: string;
	createdAt?: string;
	durationMs?: number;
	input?: string;
	output?: string;
	reasoning?: string;
	sessionId?: string;
	status?: string;
	target?: string;
}

export type NewAgentAction = Omit<AgentAction, 'id'>;
export type AgentActions = AgentAction[];
export type { AgentAction as AgentActionRecord };
export type AgentActionRecords = AgentAction[];
export type NewAgentActionRecord = Omit<AgentAction, 'id'>;

export interface AgentAttempt {
	id: string;
	approach?: string;
	attemptType?: string;
	codeSnapshot?: string;
	createdAt?: string;
	errorCategory?: string;
	errorMessage?: string;
	goalDescription?: string;
	lessonsExtracted?: boolean;
	retryCount?: number;
	retryOf?: string;
	status?: string;
	testResults?: string;
	toolId?: string;
	updatedAt?: string;
}

export type NewAgentAttempt = Omit<AgentAttempt, 'id'>;
export type AgentAttempts = AgentAttempt[];
export type { AgentAttempt as AgentAttemptRecord };
export type AgentAttemptRecords = AgentAttempt[];
export type NewAgentAttemptRecord = Omit<AgentAttempt, 'id'>;

export interface AgentComponent {
	id: string;
	createdAt?: string;
	deployedAt?: string;
	description?: string;
	name?: string;
	sourceCode?: string;
	status?: string;
	updatedAt?: string;
	version?: string;
}

export type NewAgentComponent = Omit<AgentComponent, 'id'>;
export type AgentComponents = AgentComponent[];
export type { AgentComponent as AgentComponentRecord };
export type AgentComponentRecords = AgentComponent[];
export type NewAgentComponentRecord = Omit<AgentComponent, 'id'>;

export interface AgentConversation {
	id: string;
	content?: string;
	createdAt?: string;
	isError?: boolean;
	role?: string;
	seq?: number;
	sessionId?: string;
	toolCallId?: string;
	toolCalls?: string;
}

export type NewAgentConversation = Omit<AgentConversation, 'id'>;
export type AgentConversations = AgentConversation[];
export type { AgentConversation as AgentConversationRecord };
export type AgentConversationRecords = AgentConversation[];
export type NewAgentConversationRecord = Omit<AgentConversation, 'id'>;

export interface AgentCredential {
	id: string;
	createdAt?: string;
	createdBy?: string;
	description?: string;
	key?: string;
	service?: string;
	updatedAt?: string;
	value?: string;
}

export type NewAgentCredential = Omit<AgentCredential, 'id'>;
export type AgentCredentials = AgentCredential[];
export type { AgentCredential as AgentCredentialRecord };
export type AgentCredentialRecords = AgentCredential[];
export type NewAgentCredentialRecord = Omit<AgentCredential, 'id'>;

export interface AgentGoal {
	id: string;
	alternativeApproaches?: string;
	approach?: string;
	attemptCount?: number;
	completionCriteria?: string;
	createdAt?: string;
	currentAttemptId?: string;
	goal?: string;
	maxAttempts?: number;
	parentGoalId?: string;
	priority?: number;
	status?: string;
	toolId?: string;
	updatedAt?: string;
}

export type NewAgentGoal = Omit<AgentGoal, 'id'>;
export type AgentGoals = AgentGoal[];
export type { AgentGoal as AgentGoalRecord };
export type AgentGoalRecords = AgentGoal[];
export type NewAgentGoalRecord = Omit<AgentGoal, 'id'>;

export interface AgentKnowledge {
	id: string;
	confidence?: number;
	createdAt?: string;
	domain?: string;
	embedding?: number[];
	lesson?: string;
	lessonType?: string;
	refutationCount?: number;
	sourceAttemptId?: string;
	status?: string;
	tags?: string;
	updatedAt?: string;
	validationCount?: number;
}

export type NewAgentKnowledge = Omit<AgentKnowledge, 'id'>;
export type { AgentKnowledge as AgentKnowledgeRecord };
export type AgentKnowledgeRecords = AgentKnowledge[];
export type NewAgentKnowledgeRecord = Omit<AgentKnowledge, 'id'>;

export interface AgentMemory {
	id: string;
	category?: string;
	content?: string;
	createdAt?: string;
	embedding?: number[];
	importance?: number;
	source?: string;
	updatedAt?: string;
}

export type NewAgentMemory = Omit<AgentMemory, 'id'>;
export type { AgentMemory as AgentMemoryRecord };
export type AgentMemoryRecords = AgentMemory[];
export type NewAgentMemoryRecord = Omit<AgentMemory, 'id'>;

export interface AgentTool {
	id: string;
	author?: string;
	category?: string;
	consecutiveFailures?: number;
	createdAt?: string;
	description?: string;
	functionBody?: string;
	lastUsedAt?: string;
	name?: string;
	parameters?: string;
	status?: string;
	updatedAt?: string;
	usageCount?: number;
	version?: number;
}

export type NewAgentTool = Omit<AgentTool, 'id'>;
export type AgentTools = AgentTool[];
export type { AgentTool as AgentToolRecord };
export type AgentToolRecords = AgentTool[];
export type NewAgentToolRecord = Omit<AgentTool, 'id'>;

export interface AgentUsage {
	id: string;
	completionTokens?: number;
	createdAt?: string;
	estimatedCost?: number;
	latencyMs?: number;
	model?: string;
	promptTokens?: number;
	provider?: string;
	sessionId?: string;
}

export type NewAgentUsage = Omit<AgentUsage, 'id'>;
export type { AgentUsage as AgentUsageRecord };
export type AgentUsageRecords = AgentUsage[];
export type NewAgentUsageRecord = Omit<AgentUsage, 'id'>;

export interface BusinessRule {
	key: string;
	enabled?: boolean;
	description?: string;
	params?: any;
	kind?: string;
}

export type NewBusinessRule = Omit<BusinessRule, 'key'>;
export type { BusinessRule as BusinessRuleRecord };
export type BusinessRuleRecords = BusinessRule[];
export type NewBusinessRuleRecord = Omit<BusinessRule, 'key'>;

export interface Campaign {
	id: string;
	name?: string;
	enabled?: boolean;
	headline?: string;
	messageTemplate?: string;
	targetPersona?: string;
	minVisitsLast30Days?: number;
	requiresLapsedDays?: number;
	timeWindow?: string;
	offer?: string;
	notes?: string;
}

export type NewCampaign = Omit<Campaign, 'id'>;
export type { Campaign as CampaignRecord };
export type CampaignRecords = Campaign[];
export type NewCampaignRecord = Omit<Campaign, 'id'>;

export interface Customer {
	id: string;
	personaKey?: string;
	name?: string;
	signupDate?: string;
	lastOrderAt?: string;
	lastPromoAt?: string;
	totalOrders?: number;
	totalSpend?: number;
	notes?: string;
}

export type NewCustomer = Omit<Customer, 'id'>;
export type { Customer as CustomerRecord };
export type CustomerRecords = Customer[];
export type NewCustomerRecord = Omit<Customer, 'id'>;

export interface HarperResource {
	id: any;
	__createdtime__?: any;
	__updatedtime__?: any;
	author?: any;
	content_hash?: any;
	content_type?: any;
	description?: any;
	external_source?: any;
	full_content?: any;
	image_url?: any;
	publish_date?: any;
	reading_time_minutes?: any;
	scraped_at?: any;
	summary?: any;
	tags?: any;
	title?: any;
	url?: any;
}

export type NewHarperResource = Omit<HarperResource, 'id'>;
export type HarperResources = HarperResource[];
export type { HarperResource as HarperResourceRecord };
export type HarperResourceRecords = HarperResource[];
export type NewHarperResourceRecord = Omit<HarperResource, 'id'>;

export interface Order {
	id: string;
	customerId?: string;
	storeId?: string;
	timestamp?: string;
	total?: number;
	items?: any;
}

export type NewOrder = Omit<Order, 'id'>;
export type { Order as OrderRecord };
export type OrderRecords = Order[];
export type NewOrderRecord = Omit<Order, 'id'>;

export interface RSSMonitoring {
	id: any;
	__createdtime__?: any;
	__updatedtime__?: any;
	error_message?: any;
	feed_url?: any;
	items_found?: any;
	last_checked?: any;
	last_item_date?: any;
	status?: any;
}

export type NewRSSMonitoring = Omit<RSSMonitoring, 'id'>;
export type { RSSMonitoring as RSSMonitoringRecord };
export type RSSMonitoringRecords = RSSMonitoring[];
export type NewRSSMonitoringRecord = Omit<RSSMonitoring, 'id'>;

export interface Store {
	id: string;
	name?: string;
	address?: string;
	city?: string;
	state?: string;
	latitude?: number;
	longitude?: number;
	h3Cell?: string;
}

export type NewStore = Omit<Store, 'id'>;
export type { Store as StoreRecord };
export type StoreRecords = Store[];
export type NewStoreRecord = Omit<Store, 'id'>;

export interface TestNote {
	id: any;
	__createdtime__?: any;
	__updatedtime__?: any;
	body?: any;
	priority?: any;
	title?: any;
}

export type NewTestNote = Omit<TestNote, 'id'>;
export type TestNotes = TestNote[];
export type { TestNote as TestNoteRecord };
export type TestNoteRecords = TestNote[];
export type NewTestNoteRecord = Omit<TestNote, 'id'>;

export interface WalmartStore {
	id: string;
	address?: string;
	city?: string;
	latitude?: number;
	longitude?: number;
	name?: string;
	state?: string;
	store_id?: string;
}

export type NewWalmartStore = Omit<WalmartStore, 'id'>;
export type { WalmartStore as WalmartStoreRecord };
export type WalmartStoreRecords = WalmartStore[];
export type NewWalmartStoreRecord = Omit<WalmartStore, 'id'>;

export interface geofence_Store {
	id: string;
	address?: string;
	city?: string;
	latitude?: number;
	longitude?: number;
	name?: string;
	state?: string;
	store_id?: string;
	zip?: string;
}

export type geofence_NewStore = Omit<geofence_Store, 'id'>;
export type { geofence_Store as geofence_StoreRecord };
export type geofence_StoreRecords = geofence_Store[];
export type geofence_NewStoreRecord = Omit<geofence_Store, 'id'>;

export interface geolookup_Cell {
	h3_index: string;
	tier_1?: string;
	tier_2?: string;
	tier_3?: string;
}

export type geolookup_NewCell = Omit<geolookup_Cell, 'h3_index'>;
export type { geolookup_Cell as geolookup_CellRecord };
export type geolookup_CellRecords = geolookup_Cell[];
export type geolookup_NewCellRecord = Omit<geolookup_Cell, 'h3_index'>;

export interface geolookup_DataLoadJob {
	id: string;
	cell_count?: number;
	completed_at?: string;
	duration_ms?: number;
	error_message?: string;
	location_count?: number;
	started_at?: string;
	state?: string;
	status?: string;
}

export type geolookup_NewDataLoadJob = Omit<geolookup_DataLoadJob, 'id'>;
export type { geolookup_DataLoadJob as geolookup_DataLoadJobRecord };
export type geolookup_DataLoadJobRecords = geolookup_DataLoadJob[];
export type geolookup_NewDataLoadJobRecord = Omit<geolookup_DataLoadJob, 'id'>;

export interface geolookup_Location {
	id: string;
	country_code?: string;
	county_fips?: string;
	county_name?: string;
	feature_type?: string;
	h3_index?: string;
	lat?: number;
	lon?: number;
	lsad?: string;
	name?: string;
	name_full?: string;
	state_abbrev?: string;
	state_name?: string;
	tier?: number;
	tier_label?: string;
}

export type geolookup_NewLocation = Omit<geolookup_Location, 'id'>;
export type { geolookup_Location as geolookup_LocationRecord };
export type geolookup_LocationRecords = geolookup_Location[];
export type geolookup_NewLocationRecord = Omit<geolookup_Location, 'id'>;
