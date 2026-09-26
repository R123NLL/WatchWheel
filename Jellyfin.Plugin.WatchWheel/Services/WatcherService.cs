using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Plugin.WatchWheel.Models;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.WatchWheel.Services;

#pragma warning disable SA1611, SA1615 // Public service API is documented by method summaries.

/// <summary>Owns persistent watcher profiles and canonical media assignments.</summary>
public class WatcherService
{
    private readonly object _sync = new();
    private readonly ILibraryManager _libraryManager;

    /// <summary>Initializes a new instance of the <see cref="WatcherService"/> class.</summary>
    public WatcherService(ILibraryManager libraryManager)
    {
        _libraryManager = libraryManager;
    }

    /// <summary>Gets a snapshot of all watchers.</summary>
    public IReadOnlyList<WatcherProfile> GetWatchers()
    {
        lock (_sync)
        {
            return Configuration().Watchers
                .Where(watcher => watcher.Id != Guid.Empty && !string.IsNullOrWhiteSpace(watcher.Name))
                .GroupBy(watcher => watcher.Id)
                .Select(group => Copy(group.First()))
                .OrderBy(watcher => watcher.Name, StringComparer.CurrentCultureIgnoreCase)
                .ToArray();
        }
    }

    /// <summary>Determines whether a watcher exists.</summary>
    public bool Exists(Guid watcherId) => GetWatchers().Any(watcher => watcher.Id == watcherId);

    /// <summary>Creates a watcher with a stable random identifier.</summary>
    public WatcherProfile Create(string? name)
    {
        lock (_sync)
        {
            var normalized = ValidateName(name);
            var configuration = Configuration();
            EnsureUniqueName(configuration.Watchers, normalized, null);
            var watcher = new WatcherProfile { Id = Guid.NewGuid(), Name = normalized };
            configuration.Watchers.Add(watcher);
            Save(configuration);
            return Copy(watcher);
        }
    }

    /// <summary>Renames a watcher without changing its identifier.</summary>
    public WatcherProfile? Rename(Guid watcherId, string? name)
    {
        lock (_sync)
        {
            var normalized = ValidateName(name);
            var configuration = Configuration();
            var watcher = configuration.Watchers.FirstOrDefault(value => value.Id == watcherId);
            if (watcher is null)
            {
                return null;
            }

            EnsureUniqueName(configuration.Watchers, normalized, watcherId);
            watcher.Name = normalized;
            Save(configuration);
            return Copy(watcher);
        }
    }

    /// <summary>Deletes a watcher and removes only that watcher from assignments.</summary>
    public bool Delete(Guid watcherId)
    {
        lock (_sync)
        {
            var configuration = Configuration();
            if (configuration.Watchers.RemoveAll(watcher => watcher.Id == watcherId) == 0)
            {
                return false;
            }

            foreach (var assignment in configuration.WatcherAssignments)
            {
                assignment.WatcherIds.RemoveAll(id => id == watcherId);
            }

            configuration.WatcherAssignments.RemoveAll(assignment => assignment.WatcherIds.Count == 0);
            Save(configuration);
            return true;
        }
    }

    /// <summary>Gets valid watcher IDs assigned to an item.</summary>
    public IReadOnlyList<Guid> GetAssignments(Guid itemId)
    {
        lock (_sync)
        {
            var configuration = Configuration();
            var valid = configuration.Watchers.Select(watcher => watcher.Id).ToHashSet();
            return configuration.WatcherAssignments
                .Where(assignment => assignment.ItemId == itemId)
                .SelectMany(assignment => assignment.WatcherIds)
                .Where(id => valid.Contains(id))
                .Distinct()
                .ToArray();
        }
    }

    /// <summary>Replaces the watcher assignments for one supported media item.</summary>
    public IReadOnlyList<Guid> SetAssignments(Guid itemId, IReadOnlyList<Guid>? watcherIds)
    {
        if (watcherIds is null)
        {
            throw new ArgumentException("WatcherIds is required.", nameof(watcherIds));
        }

        var item = _libraryManager.GetItemById(itemId);
        if (item is not Movie && item is not Series)
        {
            throw new ArgumentException("Assignments support movies and TV series only.", nameof(itemId));
        }

        lock (_sync)
        {
            var configuration = Configuration();
            var requested = watcherIds.Distinct().ToArray();
            var known = configuration.Watchers.Select(watcher => watcher.Id).ToHashSet();
            if (requested.Any(id => id == Guid.Empty || !known.Contains(id)))
            {
                throw new KeyNotFoundException("One or more watchers do not exist.");
            }

            configuration.WatcherAssignments.RemoveAll(assignment => assignment.ItemId == itemId);
            if (requested.Length > 0)
            {
                configuration.WatcherAssignments.Add(new WatcherAssignment
                {
                    ItemId = itemId,
                    WatcherIds = requested.ToList()
                });
            }

            Save(configuration);
            return requested;
        }
    }

    /// <summary>Determines whether an item is assigned to a watcher.</summary>
    public bool IsAssigned(Guid itemId, Guid watcherId) => GetAssignments(itemId).Contains(watcherId);

    private static string ValidateName(string? name)
    {
        var normalized = name?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            throw new ArgumentException("Watcher name cannot be empty.", nameof(name));
        }

        if (normalized.Length > 80)
        {
            throw new ArgumentException("Watcher name cannot exceed 80 characters.", nameof(name));
        }

        return normalized;
    }

    private static void EnsureUniqueName(IEnumerable<WatcherProfile> watchers, string name, Guid? exceptId)
    {
        if (watchers.Any(watcher => watcher.Id != exceptId
            && string.Equals(watcher.Name?.Trim(), name, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("A watcher with that name already exists.");
        }
    }

    private static WatcherProfile Copy(WatcherProfile watcher) => new() { Id = watcher.Id, Name = watcher.Name.Trim() };

    private static Configuration.PluginConfiguration Configuration()
    {
        var configuration = Plugin.Instance?.Configuration
            ?? throw new InvalidOperationException("Watch Wheel is not initialized.");
        configuration.Watchers ??= [];
        configuration.WatcherAssignments ??= [];
        foreach (var assignment in configuration.WatcherAssignments)
        {
            assignment.WatcherIds ??= [];
        }

        return configuration;
    }

    private static void Save(Configuration.PluginConfiguration configuration)
        => (Plugin.Instance ?? throw new InvalidOperationException("Watch Wheel is not initialized."))
            .UpdateConfiguration(configuration);
}
#pragma warning restore SA1611, SA1615
