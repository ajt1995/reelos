import { n as persist, r as create } from "../_libs/zustand.mjs";
import { S as titleIsAccessible, g as providerDisabledConnection, m as accessibleTitleIds, p as DEFAULT_DEBRID_CONNECTION } from "./router-M-yvs45k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/experience-state-BipBJc8l.js
var defaultTonight = {
	mood: "",
	duration: "any",
	kind: "all",
	person: "",
	exploration: "balanced"
};
var EMPTY_SETUP_PROFILE = {
	id: "",
	name: "",
	color: "#2563eb",
	motion: "subtle",
	density: "comfortable",
	exploration: "balanced",
	reactions: {},
	dismissedTasteIds: [],
	lessLikeIds: [],
	savedIds: [],
	progress: {},
	bookProgress: {},
	audioPreference: "original",
	subtitleLanguage: "English"
};
var unique = (items) => [...new Set(items)];
var useExperienceStore = create()(persist((set, get) => ({
	adapter: "service",
	view: "setup",
	activeProfileId: "",
	profiles: [],
	kidsPresentIds: [],
	tonight: defaultTonight,
	requests: {},
	connectedDevices: [],
	debrid: DEFAULT_DEBRID_CONNECTION,
	onboardingComplete: false,
	setupDraft: {},
	setSetupDraft: (setupDraft) => set({ setupDraft }),
	setView: (view) => set({ view }),
	setActiveProfile: (activeProfileId) => set({
		activeProfileId,
		view: "home"
	}),
	addProfile: (profile) => {
		const id = `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
		set((state) => ({ profiles: [...state.profiles, {
			...profile,
			id,
			updatedAt: Date.now()
		}] }));
		return id;
	},
	patchProfile: (id, patch) => set((state) => ({ profiles: state.profiles.map((profile) => profile.id === id ? {
		...profile,
		...patch,
		updatedAt: Date.now()
	} : profile) })),
	toggleKidPresent: (id) => set((state) => ({ kidsPresentIds: state.kidsPresentIds.includes(id) ? state.kidsPresentIds.filter((item) => item !== id) : [...state.kidsPresentIds, id] })),
	setTonight: (patch) => set((state) => ({ tonight: {
		...state.tonight,
		...patch
	} })),
	clearTonight: () => set({ tonight: defaultTonight }),
	react: (profileId, itemId, reaction) => set((state) => ({ profiles: state.profiles.map((profile) => {
		if (profile.id !== profileId) return profile;
		const reactions = { ...profile.reactions };
		if (reaction) reactions[itemId] = reaction;
		else delete reactions[itemId];
		return {
			...profile,
			updatedAt: Date.now(),
			reactions,
			dismissedTasteIds: profile.dismissedTasteIds.filter((id) => id !== itemId),
			lessLikeIds: profile.lessLikeIds.filter((id) => id !== itemId)
		};
	}) })),
	dismissTaste: (profileId, itemId) => set((state) => ({ profiles: state.profiles.map((profile) => {
		if (profile.id !== profileId) return profile;
		const reactions = { ...profile.reactions };
		delete reactions[itemId];
		return {
			...profile,
			updatedAt: Date.now(),
			reactions,
			lessLikeIds: profile.lessLikeIds.filter((id) => id !== itemId),
			dismissedTasteIds: unique([...profile.dismissedTasteIds, itemId])
		};
	}) })),
	toggleLessLike: (profileId, itemId) => set((state) => ({ profiles: state.profiles.map((profile) => {
		if (profile.id !== profileId) return profile;
		const removing = profile.lessLikeIds.includes(itemId);
		const reactions = { ...profile.reactions };
		if (!removing) delete reactions[itemId];
		return {
			...profile,
			updatedAt: Date.now(),
			reactions,
			dismissedTasteIds: removing ? profile.dismissedTasteIds : profile.dismissedTasteIds.filter((id) => id !== itemId),
			lessLikeIds: removing ? profile.lessLikeIds.filter((id) => id !== itemId) : [...profile.lessLikeIds, itemId]
		};
	}) })),
	toggleSaved: (profileId, titleId, availableFromTitle) => set((state) => {
		const removing = state.profiles.find((item) => item.id === profileId)?.savedIds.includes(titleId) ?? false;
		const requestReady = state.requests[titleId]?.status === "ready";
		const accessible = availableFromTitle ?? titleIsAccessible(titleId, state.debrid);
		if (!removing && !accessible && !requestReady) return state;
		return { profiles: state.profiles.map((item) => item.id === profileId ? {
			...item,
			updatedAt: Date.now(),
			savedIds: removing ? item.savedIds.filter((id) => id !== titleId) : [...item.savedIds, titleId]
		} : item) };
	}),
	setProgress: (profileId, titleId, progress) => set((state) => ({ profiles: state.profiles.map((profile) => profile.id === profileId ? {
		...profile,
		updatedAt: Date.now(),
		progress: {
			...profile.progress,
			[titleId]: progress
		}
	} : profile) })),
	setBookProgress: (profileId, bookId, progress, location) => set((state) => ({ profiles: state.profiles.map((profile) => profile.id === profileId ? {
		...profile,
		updatedAt: Date.now(),
		bookProgress: {
			...profile.bookProgress,
			[bookId]: Math.max(0, Math.min(1, progress))
		},
		bookLocations: location ? {
			...profile.bookLocations,
			[bookId]: location
		} : profile.bookLocations
	} : profile) })),
	toggleBookBookmark: (profileId, bookId, location) => set((state) => ({ profiles: state.profiles.map((profile) => {
		if (profile.id !== profileId || !location) return profile;
		const current = profile.bookBookmarks?.[bookId] || [];
		const next = current.includes(location) ? current.filter((item) => item !== location) : unique([...current, location]);
		return {
			...profile,
			updatedAt: Date.now(),
			bookBookmarks: {
				...profile.bookBookmarks,
				[bookId]: next
			}
		};
	}) })),
	setReadingAppearance: (profileId, patch) => set((state) => ({ profiles: state.profiles.map((profile) => profile.id === profileId ? {
		...profile,
		updatedAt: Date.now(),
		readingAppearance: {
			theme: patch.theme || profile.readingAppearance?.theme || "dark",
			fontSizeIndex: Math.max(0, Math.min(4, patch.fontSizeIndex ?? profile.readingAppearance?.fontSizeIndex ?? 1))
		}
	} : profile) })),
	setRequest: (titleId, request) => set((state) => {
		const requests = { ...state.requests };
		if (request) requests[titleId] = request;
		else delete requests[titleId];
		return { requests };
	}),
	addDevice: (name) => set((state) => ({ connectedDevices: unique([...state.connectedDevices, name]) })),
	setDebridEnabled: (enabled) => set((state) => {
		if (enabled) return { debrid: {
			...state.debrid,
			enabled: true,
			status: state.debrid.status === "connected" ? "connected" : "needs-key"
		} };
		const debrid = providerDisabledConnection(state.debrid);
		return {
			debrid,
			profiles: state.profiles.map((profile) => ({
				...profile,
				savedIds: accessibleTitleIds(profile.savedIds, debrid)
			})),
			requests: Object.fromEntries(Object.entries(state.requests).filter(([titleId]) => titleIsAccessible(titleId, debrid)))
		};
	}),
	setDebridConnection: (debrid) => set({ debrid }),
	finishOnboarding: () => set({
		onboardingComplete: true,
		view: "home",
		setupDraft: {}
	}),
	hydrateProfiles: (profiles, requestedActiveId, setupComplete = false) => set((state) => {
		if (!profiles.length) return {
			profiles: [],
			activeProfileId: "",
			onboardingComplete: false,
			view: "setup",
			kidsPresentIds: [],
			connectedDevices: []
		};
		const activeProfileId = profiles.some((profile) => profile.id === requestedActiveId && !profile.summaryOnly) ? requestedActiveId : "";
		return {
			profiles,
			activeProfileId,
			onboardingComplete: setupComplete,
			kidsPresentIds: activeProfileId ? state.kidsPresentIds : [],
			tonight: defaultTonight,
			requests: {},
			view: !setupComplete ? "setup" : state.view === "setup" ? "home" : state.view
		};
	})
}), {
	name: "reelos-experience-service-v3",
	partialize: (state) => ({
		view: state.view,
		activeProfileId: state.activeProfileId,
		onboardingComplete: state.onboardingComplete,
		setupDraft: state.setupDraft
	})
}));
function activeExperienceProfile(state) {
	return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0] ?? EMPTY_SETUP_PROFILE;
}
//#endregion
export { useExperienceStore as n, activeExperienceProfile as t };
