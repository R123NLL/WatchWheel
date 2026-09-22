using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.WatchWheel.Configuration;

/// <summary>
/// Watch Wheel plugin configuration.
/// </summary>
/// <remarks>
/// Watch Wheel currently has no server-wide settings. User-facing filters,
/// recent picks, and removed-title state are stored per Jellyfin user in the
/// browser. Keeping this class allows Jellyfin to manage the plugin normally
/// without carrying template-only sample settings.
/// </remarks>
public class PluginConfiguration : BasePluginConfiguration
{
}
