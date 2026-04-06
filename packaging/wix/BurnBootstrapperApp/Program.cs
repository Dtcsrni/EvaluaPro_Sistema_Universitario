using WixToolset.BootstrapperApplicationApi;

namespace EvaluaPro.BurnBootstrapperApp;

internal static class Program
{
    private static void Main()
    {
        ManagedBootstrapperApplication.Run(new EvaluaProBootstrapperApplication());
    }
}
