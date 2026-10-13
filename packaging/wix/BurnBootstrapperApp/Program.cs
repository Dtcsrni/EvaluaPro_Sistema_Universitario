using WixToolset.BootstrapperApplicationApi;

namespace EvaluaPro.BurnBootstrapperApp;

internal static class Program
{
    private static void Main(string[] args)
    {
        if (args.Length > 0 && string.Equals(args[0], "--native-helper", StringComparison.Ordinal))
        {
            Environment.ExitCode = NativeInstallerHelper.Run(args[1..]);
            return;
        }

        ManagedBootstrapperApplication.Run(new EvaluaProBootstrapperApplication());
    }
}
