import { useState, useEffect } from "react";
import { type TeamMember, JOB_FUNCTIONS, useUpdateTeamMember } from "@/hooks/use-capacity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface MemberEditDialogProps {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberEditDialog({ member, open, onOpenChange }: MemberEditDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [jobFunction, setJobFunction] = useState("");
  const [department, setDepartment] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [company, setCompany] = useState("");

  const updateMember = useUpdateTeamMember();

  useEffect(() => {
    if (member) {
      setName(member.name);
      setEmail(member.email || "");
      setRole(member.role || "");
      setJobFunction(member.jobFunction || "");
      setDepartment(member.department || "");
      setIsExternal(member.isExternal);
      setCompany(member.company || "");
    }
  }, [member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member || !name.trim()) return;

    await updateMember.mutateAsync({
      id: member.id,
      name: name.trim(),
      email: email.trim() || null,
      role: role.trim() || null,
      jobFunction: (jobFunction || null) as TeamMember["jobFunction"],
      department: department.trim() || null,
      isExternal,
      company: isExternal ? company.trim() || null : null,
    });

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-fn">Function</Label>
            <Select value={jobFunction || "__none__"} onValueChange={(v) => setJobFunction(v === "__none__" ? "" : v)}>
              <SelectTrigger id="edit-fn">
                <SelectValue placeholder="Select function..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {JOB_FUNCTIONS.map((fn) => (
                  <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role / Title</Label>
              <Input id="edit-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior, Lead" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept">Department</Label>
              <Input id="edit-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-external"
              checked={isExternal}
              onCheckedChange={(checked) => setIsExternal(checked === true)}
            />
            <Label htmlFor="edit-external">External subcontractor</Label>
          </div>
          {isExternal && (
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input id="edit-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. ISG, Guest Software" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMember.isPending}>
              {updateMember.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
