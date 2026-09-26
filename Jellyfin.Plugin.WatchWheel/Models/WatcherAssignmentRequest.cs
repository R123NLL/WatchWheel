using System;
using System.Collections.Generic;

namespace Jellyfin.Plugin.WatchWheel.Models;

/// <summary>Request to replace an item's watcher assignments.</summary>
public class WatcherAssignmentRequest
{
    /// <summary>Gets or sets the complete watcher ID selection.</summary>
    public IReadOnlyList<Guid>? WatcherIds { get; set; }
}
