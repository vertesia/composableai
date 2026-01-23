import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, XCircle } from "lucide-react";
import { ToolCallMetrics } from "./utils";

interface ToolMetricsSummaryProps {
    metrics: ToolCallMetrics;
}

export function ToolMetricsSummary({ metrics }: ToolMetricsSummaryProps) {
    const successRate = metrics.totalCalls > 0
        ? ((metrics.successfulCalls / metrics.totalCalls) * 100).toFixed(1)
        : '0';

    const avgDurationDisplay = metrics.averageDurationMs !== undefined
        ? `${(metrics.averageDurationMs / 1000).toFixed(2)}s`
        : 'N/A';

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-muted/30 rounded-lg border mb-4">
            {/* Total Calls */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-info/10 rounded-md">
                    <Activity className="size-4 text-info" />
                </div>
                <div>
                    <div className="text-xs text-muted">Total Calls</div>
                    <div className="text-lg font-semibold">{metrics.totalCalls}</div>
                </div>
            </div>

            {/* Successful */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-success/10 rounded-md">
                    <CheckCircle2 className="size-4 text-success" />
                </div>
                <div>
                    <div className="text-xs text-muted">Successful</div>
                    <div className="text-lg font-semibold text-success">{metrics.successfulCalls}</div>
                </div>
            </div>

            {/* Failed */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-destructive/10 rounded-md">
                    <XCircle className="size-4 text-destructive" />
                </div>
                <div>
                    <div className="text-xs text-muted">Failed</div>
                    <div className="text-lg font-semibold text-destructive">{metrics.failedCalls}</div>
                </div>
            </div>

            {/* Warnings */}
            {metrics.warningCalls > 0 && (
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-attention/10 rounded-md">
                        <AlertTriangle className="size-4 text-attention" />
                    </div>
                    <div>
                        <div className="text-xs text-muted">Warnings</div>
                        <div className="text-lg font-semibold text-attention">{metrics.warningCalls}</div>
                    </div>
                </div>
            )}

            {/* Success Rate */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-success/10 rounded-md">
                    <TrendingUp className="size-4 text-success" />
                </div>
                <div>
                    <div className="text-xs text-muted">Success Rate</div>
                    <div className="text-lg font-semibold">{successRate}%</div>
                </div>
            </div>

            {/* Average Duration */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-info/10 rounded-md">
                    <Clock className="size-4 text-info" />
                </div>
                <div>
                    <div className="text-xs text-muted">Avg Duration</div>
                    <div className="text-lg font-semibold">{avgDurationDisplay}</div>
                </div>
            </div>
        </div>
    );
}
