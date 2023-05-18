using Ubiq.Voip.Implementations;

public interface IPlaybackStatsSource
{
    public PlaybackStats lastFrameStats { get; }
}