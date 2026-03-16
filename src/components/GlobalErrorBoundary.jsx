import React from "react";
import ChunkErrorScreen from "./ChunkErrorScreen";
import {
    isDynamicImportError,
    tryReloadOnce,
} from "../utils/chunkErrorHandler";

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            errorMessage: "",
        };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: String(error?.message || "Erro inesperado"),
        };
    }

    componentDidCatch(error) {
        if (isDynamicImportError(error)) {
            const reloaded = tryReloadOnce();
            if (reloaded) return;
        }
    }

    render() {
        if (this.state.hasError) {
            return <ChunkErrorScreen message={this.state.errorMessage} />;
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;