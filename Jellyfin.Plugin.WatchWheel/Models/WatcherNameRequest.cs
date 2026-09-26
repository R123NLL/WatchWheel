namespace Jellyfin.Plugin.WatchWheel.Models;

/// <summary>Request to create or rename a watcher.</summary>
public class WatcherNameRequest
{
    /// <summary>Gets or sets the requested display name.</summary>
    public string? Name { get; set; }
}
