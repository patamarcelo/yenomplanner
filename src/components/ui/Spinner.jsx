import React from "react";
import {
    Box,
    Card,
    CardContent,
    Skeleton,
    Stack,
    useTheme,
    useMediaQuery,
} from "@mui/material";

const PageSkeleton = ({ status }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    if (status !== "loading") return null;

    return (
        <Box sx={{ width: "100%", p: isMobile ? 1 : 2 }}>
            <Stack spacing={2}>

                {/* Header */}
                <Skeleton
                    variant="rounded"
                    height={40}
                    width={220}
                    sx={{ borderRadius: 1 }}
                />

                {/* Cards resumo */}
                <Stack
                    direction={isMobile ? "column" : "row"}
                    spacing={2}
                >
                    {[1, 2, 3].map((i) => (
                        <Card
                            key={i}
                            sx={{
                                flex: 1,
                                borderRadius: 1,
                                boxShadow: 0,
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <CardContent>
                                <Stack spacing={1}>
                                    <Skeleton
                                        variant="text"
                                        width="60%"
                                        height={20}
                                    />
                                    <Skeleton
                                        variant="text"
                                        width="40%"
                                        height={28}
                                    />
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>

                {/* tabela / lista */}
                <Card
                    sx={{
                        borderRadius: 1,
                        boxShadow: 0,
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <CardContent>
                        <Stack spacing={1}>
                            {[...Array(8)].map((_, i) => (
                                <Skeleton
                                    key={i}
                                    variant="rounded"
                                    height={36}
                                    sx={{ borderRadius: 1 }}
                                />
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
};

export default PageSkeleton;