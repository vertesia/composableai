import { Activity, CheckCircle2, Clock, TrendingUp, XCircle } from "lucide-react";
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Total Calls */}
            <div className="flex items-center gap-2">
                <Activity className="size-5 text-info" />
                <div>
                    <div className="text-xs text-muted">Total Calls</div>
                    <div className="text-lg font-semibold">{metrics.totalCalls}</div>
                </div>
            </div>

            {/* Successful */}
            <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                <div>
                    <div className="text-xs text-muted">Successful</div>
                    <div className="text-lg font-semibold text-success">{metrics.successfulCalls}</div>
                </div>
            </div>

            {/* Failed */}
            <div className="flex items-center gap-2">
                <XCircle className="size-5 text-destructive" />
                <div>
                    <div className="text-xs text-muted">Failed</div>
                    <div className="text-lg font-semibold text-destructive">{metrics.failedCalls}</div>
                </div>
            </div>

            {/* Success Rate */}
            <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-success" />
                <div>
                    <div className="text-xs text-muted">Success Rate</div>
                    <div className="text-lg font-semibold">{successRate}%</div>
                </div>
            </div>

            {/* Average Duration */}
            <div className="flex items-center gap-2">
                <Clock className="size-5 text-info" />
                <div>
                    <div className="text-xs text-muted">Avg Duration</div>
                    <div className="text-lg font-semibold">{avgDurationDisplay}</div>
                </div>
            </div>
        </div>
    );
}
