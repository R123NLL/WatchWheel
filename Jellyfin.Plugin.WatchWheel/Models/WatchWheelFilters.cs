using System;

namespace Jellyfin.Plugin.WatchWheel.Models;

/// <summary>
/// Represents filters that can be applied to Watch Wheel candidates.
/// </summary>
public class WatchWheelFilters
{
    /// <summary>
    /// Gets or sets the selected accessible library, or null for all libraries.
    /// </summary>
    public Guid? LibraryId { get; set; }

    /// <summary>
    /// Gets or sets the media type filter.
    /// </summary>
    public string? Type { get; set; }

    /// <summary>
    /// Gets or sets the genre filter.
    /// </summary>
    public string? Genre { get; set; }

    /// <summary>
    /// Gets or sets the decade filter.
    /// </summary>
    public int? Decade { get; set; }

    /// <summary>
    /// Gets or sets the normalized watch-status filter.
    /// </summary>
    public string WatchStatus { get; set; } = "all-unwatched";

    /// <summary>Gets or sets an optional watcher identifier.</summary>
    public Guid? WatcherId { get; set; }
}
