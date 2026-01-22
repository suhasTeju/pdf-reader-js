import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  PluginManager,
  createPluginManager,
  type PluginManagerOptions,
} from '../plugins/PluginManager';
import type { Plugin, ToolbarItem, SidebarPanelConfig, ContextMenuItem } from '../types';
import { usePDFViewer } from './usePDFViewer';

export interface UsePluginsOptions extends PluginManagerOptions {
  /** Initial plugins to register */
  initialPlugins?: Plugin[];
}

export interface UsePluginsReturn {
  /** The plugin manager instance */
  pluginManager: PluginManager;

  /** All registered plugins */
  plugins: Plugin[];

  /** Toolbar items from plugins */
  toolbarItems: ToolbarItem[];

  /** Sidebar panels from plugins */
  sidebarPanels: SidebarPanelConfig[];

  /** Context menu items from plugins */
  contextMenuItems: ContextMenuItem[];

  /** Register a plugin */
  registerPlugin: (plugin: Plugin) => Promise<void>;

  /** Unregister a plugin by name */
  unregisterPlugin: (name: string) => Promise<void>;

  /** Check if a plugin is registered */
  hasPlugin: (name: string) => boolean;
}

export function usePlugins(options: UsePluginsOptions = {}): UsePluginsReturn {
  const { initialPlugins, ...managerOptions } = options;

  // Get viewer state/actions for the plugin API
  const viewerState = usePDFViewer();

  // State for plugin-registered items
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [toolbarItems, setToolbarItems] = useState<ToolbarItem[]>([]);
  const [sidebarPanels, setSidebarPanels] = useState<SidebarPanelConfig[]>([]);
  const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItem[]>([]);

  // Create the plugin manager
  const pluginManagerRef = useRef<PluginManager | null>(null);

  const getPluginManager = useCallback(() => {
    if (!pluginManagerRef.current) {
      pluginManagerRef.current = createPluginManager({
        ...managerOptions,
        onPluginRegistered: (plugin) => {
          setPlugins((prev) => [...prev, plugin]);
          managerOptions.onPluginRegistered?.(plugin);
        },
        onPluginUnregistered: (name) => {
          setPlugins((prev) => prev.filter((p) => p.name !== name));
          managerOptions.onPluginUnregistered?.(name);
        },
        onToolbarItemsChanged: (items) => {
          setToolbarItems(items);
          managerOptions.onToolbarItemsChanged?.(items);
        },
        onSidebarPanelsChanged: (panels) => {
          setSidebarPanels(panels);
          managerOptions.onSidebarPanelsChanged?.(panels);
        },
        onContextMenuItemsChanged: (items) => {
          setContextMenuItems(items);
          managerOptions.onContextMenuItemsChanged?.(items);
        },
      });
    }
    return pluginManagerRef.current;
  }, [managerOptions]);

  // Update viewer state getter when state changes
  useEffect(() => {
    const manager = getPluginManager();
    manager.setViewerStateGetter(() => viewerState as any);
  }, [viewerState, getPluginManager]);

  // Register initial plugins
  useEffect(() => {
    if (initialPlugins && initialPlugins.length > 0) {
      const manager = getPluginManager();
      initialPlugins.forEach((plugin) => {
        manager.register(plugin);
      });
    }
  }, [initialPlugins, getPluginManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pluginManagerRef.current?.destroy();
    };
  }, []);

  // Memoized return value
  const registerPlugin = useCallback(async (plugin: Plugin) => {
    const manager = getPluginManager();
    await manager.register(plugin);
  }, [getPluginManager]);

  const unregisterPlugin = useCallback(async (name: string) => {
    const manager = getPluginManager();
    await manager.unregister(name);
  }, [getPluginManager]);

  const hasPlugin = useCallback((name: string) => {
    const manager = getPluginManager();
    return manager.hasPlugin(name);
  }, [getPluginManager]);

  return useMemo(
    () => ({
      pluginManager: getPluginManager(),
      plugins,
      toolbarItems,
      sidebarPanels,
      contextMenuItems,
      registerPlugin,
      unregisterPlugin,
      hasPlugin,
    }),
    [
      getPluginManager,
      plugins,
      toolbarItems,
      sidebarPanels,
      contextMenuItems,
      registerPlugin,
      unregisterPlugin,
      hasPlugin,
    ]
  );
}
