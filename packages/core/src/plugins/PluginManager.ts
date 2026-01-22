import type {
  Plugin,
  PluginAPI,
  ToolbarItem,
  SidebarPanelConfig,
  ContextMenuItem,
  ViewerState,
  ViewerActions,
} from '../types';

export interface PluginManagerOptions {
  /** Callback when a plugin is registered */
  onPluginRegistered?: (plugin: Plugin) => void;
  /** Callback when a plugin is unregistered */
  onPluginUnregistered?: (name: string) => void;
  /** Callback when toolbar items change */
  onToolbarItemsChanged?: (items: ToolbarItem[]) => void;
  /** Callback when sidebar panels change */
  onSidebarPanelsChanged?: (panels: SidebarPanelConfig[]) => void;
  /** Callback when context menu items change */
  onContextMenuItemsChanged?: (items: ContextMenuItem[]) => void;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private toolbarItems: Map<string, ToolbarItem[]> = new Map();
  private sidebarPanels: Map<string, SidebarPanelConfig[]> = new Map();
  private contextMenuItems: Map<string, ContextMenuItem[]> = new Map();
  private viewerStateGetter: (() => ViewerState & ViewerActions) | null = null;
  private options: PluginManagerOptions;

  constructor(options: PluginManagerOptions = {}) {
    this.options = options;
  }

  /**
   * Set the getter function for viewer state
   */
  setViewerStateGetter(getter: () => ViewerState & ViewerActions): void {
    this.viewerStateGetter = getter;
  }

  /**
   * Create the plugin API for a specific plugin
   */
  private createPluginAPI(pluginName: string): PluginAPI {
    return {
      viewer: this.viewerStateGetter?.() || ({} as ViewerState & ViewerActions),

      registerToolbarItem: (item: ToolbarItem) => {
        const items = this.toolbarItems.get(pluginName) || [];
        items.push(item);
        this.toolbarItems.set(pluginName, items);
        this.notifyToolbarItemsChanged();
      },

      registerSidebarPanel: (panel: SidebarPanelConfig) => {
        const panels = this.sidebarPanels.get(pluginName) || [];
        panels.push(panel);
        this.sidebarPanels.set(pluginName, panels);
        this.notifySidebarPanelsChanged();
      },

      registerContextMenuItem: (item: ContextMenuItem) => {
        const items = this.contextMenuItems.get(pluginName) || [];
        items.push(item);
        this.contextMenuItems.set(pluginName, items);
        this.notifyContextMenuItemsChanged();
      },
    };
  }

  /**
   * Register a plugin
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already registered. Unregister it first.`);
      return;
    }

    this.plugins.set(plugin.name, plugin);

    // Initialize the plugin if it has an initialize function
    if (plugin.initialize) {
      const api = this.createPluginAPI(plugin.name);
      await plugin.initialize(api);
    }

    this.options.onPluginRegistered?.(plugin);
  }

  /**
   * Unregister a plugin
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.warn(`Plugin "${name}" is not registered.`);
      return;
    }

    // Destroy the plugin if it has a destroy function
    if (plugin.destroy) {
      await plugin.destroy();
    }

    // Remove all registered items from this plugin
    this.toolbarItems.delete(name);
    this.sidebarPanels.delete(name);
    this.contextMenuItems.delete(name);

    this.plugins.delete(name);

    this.notifyToolbarItemsChanged();
    this.notifySidebarPanelsChanged();
    this.notifyContextMenuItemsChanged();

    this.options.onPluginUnregistered?.(name);
  }

  /**
   * Get a registered plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all toolbar items from all plugins
   */
  getToolbarItems(): ToolbarItem[] {
    const allItems: ToolbarItem[] = [];
    for (const items of this.toolbarItems.values()) {
      allItems.push(...items);
    }
    // Sort by order if specified
    return allItems.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get toolbar items by position
   */
  getToolbarItemsByPosition(position: 'left' | 'center' | 'right'): ToolbarItem[] {
    return this.getToolbarItems().filter((item) => item.position === position);
  }

  /**
   * Get all sidebar panels from all plugins
   */
  getSidebarPanels(): SidebarPanelConfig[] {
    const allPanels: SidebarPanelConfig[] = [];
    for (const panels of this.sidebarPanels.values()) {
      allPanels.push(...panels);
    }
    return allPanels;
  }

  /**
   * Get all context menu items from all plugins
   */
  getContextMenuItems(): ContextMenuItem[] {
    const allItems: ContextMenuItem[] = [];
    for (const items of this.contextMenuItems.values()) {
      allItems.push(...items);
    }
    // Filter by condition if specified
    return allItems.filter((item) => !item.condition || item.condition());
  }

  /**
   * Destroy all plugins and clean up
   */
  async destroy(): Promise<void> {
    const pluginNames = Array.from(this.plugins.keys());
    for (const name of pluginNames) {
      await this.unregister(name);
    }
  }

  private notifyToolbarItemsChanged(): void {
    this.options.onToolbarItemsChanged?.(this.getToolbarItems());
  }

  private notifySidebarPanelsChanged(): void {
    this.options.onSidebarPanelsChanged?.(this.getSidebarPanels());
  }

  private notifyContextMenuItemsChanged(): void {
    this.options.onContextMenuItemsChanged?.(this.getContextMenuItems());
  }
}

// Create a default plugin manager instance
let defaultPluginManager: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!defaultPluginManager) {
    defaultPluginManager = new PluginManager();
  }
  return defaultPluginManager;
}

export function createPluginManager(options?: PluginManagerOptions): PluginManager {
  return new PluginManager(options);
}
