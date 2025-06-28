import FormHeading from "@/components/forms/FormHeading";
import React, { useState } from "react";

interface NomineesManagementProps {
  onNextStep: () => void;
}

interface Nominee {
  id: number;
  name: string;
  panNumber: string;
  relationship: string;
  share: number;
}

const initialNominee: Nominee = {
  id: 1,
  name: "",
  panNumber: "",
  relationship: "",
  share: 0,
};

const NomineesManagement: React.FC<NomineesManagementProps> = ({
  onNextStep,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    nominees: [] as Nominee[],
    currentNominee: null as Nominee | null,
    isAddingNominee: false,
  });

  const updateFormData = (data: Partial<typeof formData>): void => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const handleAddNominee = () => {
    if (isSubmitting) return;

    updateFormData({
      isAddingNominee: true,
      currentNominee: { ...initialNominee, id: formData.nominees.length + 1 },
    });
  };

  const handleNomineeChange = (
    field: keyof Nominee,
    value: string | number
  ) => {
    if (!formData.currentNominee || isSubmitting) return;

    updateFormData({
      currentNominee: {
        ...formData.currentNominee,
        [field]: value,
      },
    });
  };

  const handleSaveNominee = async () => {
    if (!formData.currentNominee || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateFormData({
        nominees: [...formData.nominees, formData.currentNominee],
        currentNominee: null,
        isAddingNominee: false,
      });
    } catch (error) {
      console.error("Error saving nominee:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nominees.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onNextStep();
    } catch (error) {
      console.error("Error during submission:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const NomineesListPage = () => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Nominees</h1>
          <p className="text-gray-600">Step 4 of 9</p>
        </div>
        <button
          onClick={handleAddNominee}
          disabled={isSubmitting}
          className={`text-teal-800 border border-teal-800 px-4 py-2 rounded transition-colors
            ${
              isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-teal-50"
            }`}
        >
          + Add Nominee
        </button>
      </div>

      {formData.nominees.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">
            You haven&apos;t added any nominees yet.
          </p>
          <p className="text-gray-600">
            Click the Add Nominee button to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {formData.nominees.map((nominee) => (
            <div
              key={nominee.id}
              className="border rounded-lg p-4 flex justify-between items-center"
            >
              <div>
                <h3 className="font-medium">Nominee {nominee.id}</h3>
                <p className="text-gray-600">{nominee.name}</p>
                <p className="text-gray-600">
                  Relationship: {nominee.relationship}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{nominee.share}%</p>
                <p className="text-gray-600">Share</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={formData.nominees.length === 0 || isSubmitting}
        className={`w-full bg-teal-800 text-white py-3 rounded mt-6 transition-colors
          ${
            formData.nominees.length === 0 || isSubmitting
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-teal-700"
          }`}
      >
        {isSubmitting ? "Please wait..." : "Continue"}
      </button>
    </div>
  );

  const NomineeDetailsPage = () => (
    <div className="max-w-4xl mx-auto p-6">
      <FormHeading
        title={"Enter your Nominee details"}
        description={"Secure your investments for your loved ones!"}
      />

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveNominee();
        }}
      >
        <div>
          <label className="block text-gray-700 mb-2">
            Nominee {formData.currentNominee?.id}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={formData.currentNominee?.name || ""}
                onChange={(e) => handleNomineeChange("name", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Pan Number
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={formData.currentNominee?.panNumber || ""}
                onChange={(e) =>
                  handleNomineeChange("panNumber", e.target.value)
                }
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Relationship
          </label>
          <select
            className="w-full border rounded px-3 py-2"
            value={formData.currentNominee?.relationship || ""}
            onChange={(e) =>
              handleNomineeChange("relationship", e.target.value)
            }
            disabled={isSubmitting}
          >
            <option value="">Select Relationship</option>
            <option value="Spouse">Spouse</option>
            <option value="Child">Child</option>
            <option value="Parent">Parent</option>
            <option value="Sibling">Sibling</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Share %</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            min="0"
            max="100"
            value={formData.currentNominee?.share || ""}
            onChange={(e) =>
              handleNomineeChange("share", Number(e.target.value))
            }
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full bg-teal-800 text-white py-3 rounded transition-colors
            ${
              isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-teal-700"
            }`}
        >
          {isSubmitting ? "Please wait..." : "Save Nominee"}
        </button>
      </form>
    </div>
  );

  return formData.isAddingNominee ? (
    <NomineeDetailsPage />
  ) : (
    <NomineesListPage />
  );
};

export default NomineesManagement;
