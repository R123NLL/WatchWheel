using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Jellyfin.Plugin.WatchWheel.Models;
using Jellyfin.Plugin.WatchWheel.Services;
using MediaBrowser.Controller.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.WatchWheel.Controllers;

/// <summary>
/// Provides API endpoints for the Watch Wheel plugin.
/// </summary>
[ApiController]
[Route("WatchWheel")]
[Authorize]
public class WatchWheelController : ControllerBase
{
    private readonly IAuthorizationContext _authorizationContext;
    private readonly CandidateService _candidateService;
    private readonly FilterService _filterService;
    private readonly WatcherService _watcherService;

    /// <summary>
    /// Initializes a new instance of the <see cref="WatchWheelController"/> class.
    /// </summary>
    /// <param name="authorizationContext">Jellyfin authorization context.</param>
    /// <param name="candidateService">Watch Wheel candidate service.</param>
    /// <param name="filterService">Watch Wheel filter service.</param>
    /// <param name="watcherService">Watcher profile and assignment service.</param>
    public WatchWheelController(
        IAuthorizationContext authorizationContext,
        CandidateService candidateService,
        FilterService filterService,
        WatcherService watcherService)
    {
        _authorizationContext = authorizationContext;
        _candidateService = candidateService;
        _filterService = filterService;
        _watcherService = watcherService;
    }

    /// <summary>
    /// Gets the current Watch Wheel plugin status.
    /// </summary>
    /// <returns>Basic plugin status information.</returns>
    [HttpGet("Status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            Plugin = "Watch Wheel",
            Version = typeof(Plugin).Assembly.GetName().Version?.ToString() ?? "unknown",
            Status = "ready"
        });
    }

    /// <summary>
    /// Gets information about the currently authenticated Jellyfin user.
    /// </summary>
    /// <returns>The current Jellyfin user.</returns>
    [HttpGet("User")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var authorizationInfo =
            await _authorizationContext
                .GetAuthorizationInfo(Request)
                .ConfigureAwait(false);

        var user = authorizationInfo.User;

        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            UserId = user.Id,
            Username = user.Username
        });
    }

    /// <summary>
    /// Gets unwatched movies and television series for the current user.
    /// </summary>
    /// <param name="libraryId">Optional accessible library identifier.</param>
    /// <param name="type">Optional media type filter.</param>
    /// <param name="genre">Optional genre filter.</param>
    /// <param name="decade">Optional decade filter.</param>
    /// <param name="watchStatus">All-unwatched, all-media, not-started, or in-progress.</param>
    /// <param name="includeInProgress">Legacy compatibility option used when watchStatus is absent.</param>
    /// <param name="watcherId">Optional stable watcher identifier.</param>
    /// <returns>Watch Wheel candidate items.</returns>
    [HttpGet("Items")]
    public async Task<IActionResult> GetItems(
        [FromQuery] Guid? libraryId = null,
        [FromQuery] string? type = null,
        [FromQuery] string? genre = null,
        [FromQuery] int? decade = null,
        [FromQuery] string? watchStatus = null,
        [FromQuery] bool? includeInProgress = null,
        [FromQuery] Guid? watcherId = null)
    {
        var authorizationInfo =
            await _authorizationContext
                .GetAuthorizationInfo(Request)
                .ConfigureAwait(false);

        var user = authorizationInfo.User;

        if (user is null)
        {
            return Unauthorized();
        }

        if (watcherId.HasValue && !_watcherService.Exists(watcherId.Value))
        {
            return BadRequest(new { Error = "The selected watcher does not exist." });
        }

        var filters = new WatchWheelFilters
        {
            LibraryId = libraryId,
            Type = type ?? "both",
            Genre = genre,
            Decade = decade,
            WatchStatus = NormalizeWatchStatus(watchStatus, includeInProgress),
            WatcherId = watcherId
        };

        var result =
            _candidateService.GetCandidates(
                user,
                filters);

        return Ok(result);
    }

#pragma warning disable SA1611, SA1615 // HTTP contracts are described by endpoint summaries.
    /// <summary>Lists configured watcher profiles.</summary>
    [HttpGet("Watchers")]
    public IActionResult GetWatchers() => Ok(new { Watchers = _watcherService.GetWatchers() });

    /// <summary>Creates a watcher profile.</summary>
    [HttpPost("Watchers")]
    public IActionResult CreateWatcher([FromBody] WatcherNameRequest request)
    {
        try
        {
            return Ok(_watcherService.Create(request?.Name));
        }
        catch (ArgumentException error)
        {
            return BadRequest(new { Error = error.Message });
        }
        catch (InvalidOperationException error)
        {
            return Conflict(new { Error = error.Message });
        }
    }

    /// <summary>Renames a watcher profile without changing its identifier.</summary>
    [HttpPut("Watchers/{watcherId:guid}")]
    public IActionResult RenameWatcher(Guid watcherId, [FromBody] WatcherNameRequest request)
    {
        try
        {
            var watcher = _watcherService.Rename(watcherId, request?.Name);
            return watcher is null ? NotFound() : Ok(watcher);
        }
        catch (ArgumentException error)
        {
            return BadRequest(new { Error = error.Message });
        }
        catch (InvalidOperationException error)
        {
            return Conflict(new { Error = error.Message });
        }
    }

    /// <summary>Deletes a watcher and removes that ID from all assignments.</summary>
    [HttpDelete("Watchers/{watcherId:guid}")]
    public IActionResult DeleteWatcher(Guid watcherId)
        => _watcherService.Delete(watcherId) ? NoContent() : NotFound();

    /// <summary>Gets watcher assignments for a movie or series.</summary>
    [HttpGet("Assignments/{itemId:guid}")]
    public IActionResult GetAssignments(Guid itemId)
        => Ok(new { ItemId = itemId, WatcherIds = _watcherService.GetAssignments(itemId) });

    /// <summary>Replaces watcher assignments for a movie or series.</summary>
    [HttpPut("Assignments/{itemId:guid}")]
    public IActionResult SetAssignments(Guid itemId, [FromBody] WatcherAssignmentRequest request)
    {
        try
        {
            var watcherIds = _watcherService.SetAssignments(itemId, request?.WatcherIds);
            return Ok(new { ItemId = itemId, WatcherIds = watcherIds });
        }
        catch (KeyNotFoundException error)
        {
            return BadRequest(new { Error = error.Message });
        }
        catch (ArgumentException error)
        {
            return BadRequest(new { Error = error.Message });
        }
    }
#pragma warning restore SA1611, SA1615

    private static string NormalizeWatchStatus(string? watchStatus, bool? includeInProgress)
    {
        var normalized = watchStatus?.Trim().ToLowerInvariant();
        if (normalized is "all-unwatched" or "all-media" or "not-started" or "in-progress")
        {
            return normalized;
        }

        // The old false value meant "not started"; true/default meant all unwatched.
        return includeInProgress == false ? "not-started" : "all-unwatched";
    }

    /// <summary>
    /// Gets the available Watch Wheel filter options for the current user.
    /// </summary>
    /// <returns>Available media types, genres, and decades.</returns>
    [HttpGet("Filters")]
    public async Task<IActionResult> GetFilters()
    {
        var authorizationInfo =
            await _authorizationContext
                .GetAuthorizationInfo(Request)
                .ConfigureAwait(false);

        var user = authorizationInfo.User;

        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(
            _filterService.GetAvailableFilters(user));
    }
}
