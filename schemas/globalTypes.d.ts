/**
 Generated from your schema files
 Manual changes will be lost!
 > harper dev .
 */
import type { Table } from 'harperdb';
import type { AgentAction, AgentAttempt, AgentComponent, AgentConversation, AgentCredential, AgentGoal, AgentKnowledge, AgentMemory, AgentTool, AgentUsage, BusinessRule, Campaign, Customer, HarperResource, Order, RSSMonitoring, Store, TestNote, WalmartStore, geofence_Store, geolookup_Cell, geolookup_DataLoadJob, geolookup_Location } from './types.ts';

declare module 'harperdb' {
	export const tables: {
		AgentActions: { new(...args: any[]): Table<AgentAction> };
		AgentAttempts: { new(...args: any[]): Table<AgentAttempt> };
		AgentComponents: { new(...args: any[]): Table<AgentComponent> };
		AgentConversations: { new(...args: any[]): Table<AgentConversation> };
		AgentCredentials: { new(...args: any[]): Table<AgentCredential> };
		AgentGoals: { new(...args: any[]): Table<AgentGoal> };
		AgentKnowledge: { new(...args: any[]): Table<AgentKnowledge> };
		AgentMemory: { new(...args: any[]): Table<AgentMemory> };
		AgentTools: { new(...args: any[]): Table<AgentTool> };
		AgentUsage: { new(...args: any[]): Table<AgentUsage> };
		BusinessRule: { new(...args: any[]): Table<BusinessRule> };
		Campaign: { new(...args: any[]): Table<Campaign> };
		Customer: { new(...args: any[]): Table<Customer> };
		HarperResources: { new(...args: any[]): Table<HarperResource> };
		Order: { new(...args: any[]): Table<Order> };
		RSSMonitoring: { new(...args: any[]): Table<RSSMonitoring> };
		Store: { new(...args: any[]): Table<Store> };
		TestNotes: { new(...args: any[]): Table<TestNote> };
		WalmartStore: { new(...args: any[]): Table<WalmartStore> };
	};

	export const databases: {
		data: {
			AgentActions: { new(...args: any[]): Table<AgentAction> };
			AgentAttempts: { new(...args: any[]): Table<AgentAttempt> };
			AgentComponents: { new(...args: any[]): Table<AgentComponent> };
			AgentConversations: { new(...args: any[]): Table<AgentConversation> };
			AgentCredentials: { new(...args: any[]): Table<AgentCredential> };
			AgentGoals: { new(...args: any[]): Table<AgentGoal> };
			AgentKnowledge: { new(...args: any[]): Table<AgentKnowledge> };
			AgentMemory: { new(...args: any[]): Table<AgentMemory> };
			AgentTools: { new(...args: any[]): Table<AgentTool> };
			AgentUsage: { new(...args: any[]): Table<AgentUsage> };
			BusinessRule: { new(...args: any[]): Table<BusinessRule> };
			Campaign: { new(...args: any[]): Table<Campaign> };
			Customer: { new(...args: any[]): Table<Customer> };
			HarperResources: { new(...args: any[]): Table<HarperResource> };
			Order: { new(...args: any[]): Table<Order> };
			RSSMonitoring: { new(...args: any[]): Table<RSSMonitoring> };
			Store: { new(...args: any[]): Table<Store> };
			TestNotes: { new(...args: any[]): Table<TestNote> };
			WalmartStore: { new(...args: any[]): Table<WalmartStore> };
		};
		geofence: {
			Store: { new(...args: any[]): Table<geofence_Store> };
		};
		geolookup: {
			Cell: { new(...args: any[]): Table<geolookup_Cell> };
			DataLoadJob: { new(...args: any[]): Table<geolookup_DataLoadJob> };
			Location: { new(...args: any[]): Table<geolookup_Location> };
		};
	};
}
