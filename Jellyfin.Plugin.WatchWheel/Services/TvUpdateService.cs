using System;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using Jellyfin.Plugin.WatchWheel.Models;

namespace Jellyfin.Plugin.WatchWheel.Services;

/// <summary>Loads and validates the private Android TV update bundle served by the plugin.</summary>
public sealed class TvUpdateService
{
    private const long MaxMetadataBytes = 64 * 1024;
    private const long MaxApkBytes = 512L * 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>Initializes a new instance of the <see cref="TvUpdateService"/> class.</summary>
    public TvUpdateService()
    {
        var configured = Environment.GetEnvironmentVariable("WATCHWHEEL_TV_UPDATES");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            UpdateDirectory = Path.GetFullPath(configured);
            return;
        }

        var assemblyDirectory = Path.GetDirectoryName(typeof(Plugin).Assembly.Location)
            ?? AppContext.BaseDirectory;
        UpdateDirectory = Path.Combine(assemblyDirectory, "TvUpdates");
    }

    /// <summary>Gets the directory from which private TV update artifacts are served.</summary>
    public string UpdateDirectory { get; }

    /// <summary>Gets the currently published update, or null when no update bundle is present.</summary>
    /// <returns>The validated update package.</returns>
    public TvUpdatePackage? GetCurrent()
    {
        var metadataPath = Path.Combine(UpdateDirectory, "update.json");
        if (!File.Exists(metadataPath))
        {
            return null;
        }

        var metadataFile = new FileInfo(metadataPath);
        if (metadataFile.Length <= 0 || metadataFile.Length > MaxMetadataBytes)
        {
            throw new InvalidDataException("TV update metadata has an invalid size.");
        }

        var metadata = JsonSerializer.Deserialize<TvUpdateInfo>(File.ReadAllText(metadataPath), JsonOptions)
            ?? throw new InvalidDataException("TV update metadata could not be read.");

        ValidateMetadata(metadata);

        var apkName = Path.GetFileName(metadata.Apk);
        if (!string.Equals(apkName, metadata.Apk, StringComparison.Ordinal))
        {
            throw new InvalidDataException("TV update APK filename is invalid.");
        }

        var apkPath = Path.Combine(UpdateDirectory, apkName);
        if (!File.Exists(apkPath))
        {
            throw new InvalidDataException("TV update APK is missing.");
        }

        var apk = new FileInfo(apkPath);
        if (apk.Length != metadata.SizeBytes || apk.Length <= 0 || apk.Length > MaxApkBytes)
        {
            throw new InvalidDataException("TV update APK size does not match update.json.");
        }

        using var stream = File.OpenRead(apkPath);
        var digest = Convert.ToHexString(SHA256.HashData(stream));
        if (!string.Equals(digest, metadata.Sha256, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("TV update APK SHA-256 does not match update.json.");
        }

        // The public path is fixed by the server and never trusted from uploaded metadata.
        metadata.DownloadPath = "/WatchWheel/TvUpdate/Apk";

        return new TvUpdatePackage(metadata, apkPath);
    }

    private static void ValidateMetadata(TvUpdateInfo metadata)
    {
        if (string.IsNullOrWhiteSpace(metadata.Version)
            || metadata.Version.Length > 64
            || metadata.VersionCode <= 0
            || !string.Equals(metadata.PackageName, "org.watchwheel.tv.next", StringComparison.Ordinal)
            || string.IsNullOrWhiteSpace(metadata.BundledWebVersion)
            || metadata.BundledWebVersion.Length > 64
            || string.IsNullOrWhiteSpace(metadata.Apk)
            || !metadata.Apk.EndsWith(".apk", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(metadata.Sha256)
            || metadata.Sha256.Length != 64
            || !IsLowerHex(metadata.Sha256)
            || metadata.SizeBytes <= 0
            || metadata.SizeBytes > MaxApkBytes
            || metadata.ReleaseNotes is null
            || metadata.ReleaseNotes.Length > 8000)
        {
            throw new InvalidDataException("TV update metadata is invalid.");
        }
    }

    private static bool IsLowerHex(string value)
    {
        foreach (var character in value)
        {
            if ((character < '0' || character > '9') && (character < 'a' || character > 'f'))
            {
                return false;
            }
        }

        return true;
    }
}
