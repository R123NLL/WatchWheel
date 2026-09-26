using System;

namespace Jellyfin.Plugin.WatchWheel.Models;

/// <summary>Plugin-owned watcher profile.</summary>
public class WatcherProfile
{
    /// <summary>Gets or sets the stable watcher identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Gets or sets the editable display name.</summary>
    public string Name { get; set; } = string.Empty;
}
