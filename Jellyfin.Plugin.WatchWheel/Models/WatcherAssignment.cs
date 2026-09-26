using System;
using System.Collections.Generic;

namespace Jellyfin.Plugin.WatchWheel.Models;

#pragma warning disable CA1002, CA2227 // Mutable XML-serialized configuration record.

/// <summary>Canonical Watch Wheel watcher assignment for a movie or series.</summary>
public class WatcherAssignment
{
    /// <summary>Gets or sets the Jellyfin movie or series identifier.</summary>
    public Guid ItemId { get; set; }

    /// <summary>Gets or sets stable watcher identifiers assigned to the item.</summary>
    public List<Guid> WatcherIds { get; set; } = [];
}
#pragma warning restore CA1002, CA2227
