using System.Collections.Generic;
using Jellyfin.Plugin.WatchWheel.Models;
using MediaBrowser.Model.Plugins;

#pragma warning disable CA1002, CA2227 // Mutable XML-serialized plugin configuration collections.

namespace Jellyfin.Plugin.WatchWheel.Configuration;

/// <summary>
/// Watch Wheel plugin configuration.
/// </summary>
/// <remarks>
/// Watcher profiles and assignments are canonical plugin-owned data. User-facing
/// filter preferences and recent picks remain client-local.
/// </remarks>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Gets or sets configured watcher profiles.</summary>
    public List<WatcherProfile> Watchers { get; set; } = [];

    /// <summary>Gets or sets movie and series watcher assignments.</summary>
    public List<WatcherAssignment> WatcherAssignments { get; set; } = [];
}
#pragma warning restore CA1002, CA2227
