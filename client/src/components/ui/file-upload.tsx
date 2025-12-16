import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileAttachment {
    name: string;
    url: string;
    type?: string;
}

interface FileUploadProps {
    value?: FileAttachment[];
    onChange: (files: FileAttachment[]) => void;
    maxFiles?: number;
    accept?: string;
}

export function FileUpload({ value = [], onChange, maxFiles = 5, accept = "*/*" }: FileUploadProps) {
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (value.length + files.length > maxFiles) {
            toast({
                title: "Too many files",
                description: `You can only upload a maximum of ${maxFiles} files.`,
                variant: "destructive",
            });
            return;
        }

        setUploading(true);
        const newAttachments: FileAttachment[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/uploads", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                const data = await res.json();
                newAttachments.push({
                    name: data.originalName,
                    url: data.url,
                    type: data.mimeType,
                });
            }

            onChange([...value, ...newAttachments]);
        } catch (error: any) {
            toast({
                title: "Upload failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = "";
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...value];
        newFiles.splice(index, 1);
        onChange(newFiles);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {value.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded-md text-sm border">
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[150px]">
                            {file.name}
                        </a>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-1"
                            onClick={() => removeFile(index)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <Input
                    type="file"
                    className="hidden"
                    id="file-upload"
                    multiple
                    accept={accept}
                    onChange={handleFileChange}
                    disabled={uploading || value.length >= maxFiles}
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={uploading || value.length >= maxFiles}
                    onClick={() => document.getElementById("file-upload")?.click()}
                >
                    {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Paperclip className="w-4 h-4 mr-2" />
                    )}
                    {uploading ? "Uploading..." : "Attach Files"}
                </Button>
                <span className="text-xs text-muted-foreground">
                    {value.length} / {maxFiles} files
                </span>
            </div>
        </div>
    );
}
