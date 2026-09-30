using Jellyfin.Plugin.WatchWheel.Models;

namespace Jellyfin.Plugin.WatchWheel.Services;

/// <summary>Pairs validated TV update metadata with its local APK path.</summary>
public sealed class TvUpdatePackage
{
    /// <summary>Initializes a new instance of the <see cref="TvUpdatePackage"/> class.</summary>
    /// <param name="info">Validated update metadata.</param>
    /// <param name="apkPath">Validated APK path.</param>
    public TvUpdatePackage(TvUpdateInfo info, string apkPath)
    {
        Info = info;
        ApkPath = apkPath;
    }

    /// <summary>Gets validated update metadata.</summary>
    public TvUpdateInfo Info { get; }

    /// <summary>Gets the validated local APK path.</summary>
    public string ApkPath { get; }
}
