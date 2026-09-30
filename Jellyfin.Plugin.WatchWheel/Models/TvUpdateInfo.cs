using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.WatchWheel.Models;

/// <summary>Describes one private WatchWheel TV update package.</summary>
public sealed class TvUpdateInfo
{
    /// <summary>Gets or sets the human-readable TV app version.</summary>
    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    /// <summary>Gets or sets the monotonically increasing Android version code.</summary>
    [JsonPropertyName("versionCode")]
    public int VersionCode { get; set; }

    /// <summary>Gets or sets the Android application package name.</summary>
    [JsonPropertyName("packageName")]
    public string PackageName { get; set; } = string.Empty;

    /// <summary>Gets or sets the bundled Watch Wheel Web version.</summary>
    [JsonPropertyName("bundledWebVersion")]
    public string BundledWebVersion { get; set; } = string.Empty;

    /// <summary>Gets or sets the APK filename.</summary>
    [JsonPropertyName("apk")]
    public string Apk { get; set; } = string.Empty;

    /// <summary>Gets or sets the lowercase SHA-256 digest of the APK.</summary>
    [JsonPropertyName("sha256")]
    public string Sha256 { get; set; } = string.Empty;

    /// <summary>Gets or sets the exact APK size in bytes.</summary>
    [JsonPropertyName("sizeBytes")]
    public long SizeBytes { get; set; }

    /// <summary>Gets or sets the publication timestamp.</summary>
    [JsonPropertyName("publishedAtUtc")]
    public string PublishedAtUtc { get; set; } = string.Empty;

    /// <summary>Gets or sets release notes shown by the TV app.</summary>
    [JsonPropertyName("releaseNotes")]
    public string ReleaseNotes { get; set; } = string.Empty;

    /// <summary>Gets or sets the authenticated Jellyfin download endpoint.</summary>
    [JsonPropertyName("downloadUrl")]
    public string DownloadPath { get; set; } = "/WatchWheel/TvUpdate/Apk";
}
